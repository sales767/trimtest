// Web Bluetooth driver for Leica DISTO laser distance meters.
// Uses the well-known DISTO custom service. Feature-detect
// `navigator.bluetooth` before showing UI — Safari and non-HTTPS contexts
// will not have it.
//
// Service:              3ab10100-f831-4395-b29d-570977d5bf94
// Distance (Float32 m): 3ab10101-f831-4395-b29d-570977d5bf94  (notify)
//
// The device pushes a Float32 little-endian meters value on each shot.
// We resolve the next-arriving value as one reading.

const DISTO_SERVICE = "3ab10100-f831-4395-b29d-570977d5bf94";
const DISTO_DISTANCE = "3ab10101-f831-4395-b29d-570977d5bf94";

type BT = {
  requestDevice: (opts: unknown) => Promise<BluetoothDevice>;
};
type BluetoothDevice = {
  name?: string;
  gatt?: {
    connected: boolean;
    connect: () => Promise<BluetoothRemoteGATTServer>;
    disconnect: () => void;
  };
  addEventListener: (t: string, fn: () => void) => void;
};
type BluetoothRemoteGATTServer = {
  getPrimaryService: (uuid: string) => Promise<BluetoothRemoteGATTService>;
};
type BluetoothRemoteGATTService = {
  getCharacteristic: (uuid: string) => Promise<BluetoothRemoteGATTCharacteristic>;
};
type BluetoothRemoteGATTCharacteristic = {
  startNotifications: () => Promise<BluetoothRemoteGATTCharacteristic>;
  addEventListener: (t: string, fn: (e: Event) => void) => void;
  value?: DataView;
};

export function isLaserSupported(): boolean {
  return typeof navigator !== "undefined" && "bluetooth" in navigator;
}

let device: BluetoothDevice | null = null;
let distanceChar: BluetoothRemoteGATTCharacteristic | null = null;
const waiters: Array<(mm: number) => void> = [];

function onNotification(e: Event) {
  const target = e.target as BluetoothRemoteGATTCharacteristic;
  const dv = target.value;
  if (!dv) return;
  const meters = dv.getFloat32(0, true);
  if (!Number.isFinite(meters) || meters <= 0) return;
  const mm = Math.round(meters * 1000);
  const list = waiters.splice(0, waiters.length);
  for (const w of list) w(mm);
}

export async function connectLaser(): Promise<string> {
  if (!isLaserSupported()) throw new Error("Web Bluetooth is not available in this browser");
  const bt = (navigator as unknown as { bluetooth: BT }).bluetooth;
  const dev = await bt.requestDevice({
    filters: [{ services: [DISTO_SERVICE] }],
    optionalServices: [DISTO_SERVICE],
  });
  if (!dev.gatt) throw new Error("Device has no GATT server");
  const server = await dev.gatt.connect();
  const svc = await server.getPrimaryService(DISTO_SERVICE);
  const ch = await svc.getCharacteristic(DISTO_DISTANCE);
  await ch.startNotifications();
  ch.addEventListener("characteristicvaluechanged", onNotification);
  dev.addEventListener("gattserverdisconnected", () => {
    device = null;
    distanceChar = null;
  });
  device = dev;
  distanceChar = ch;
  return dev.name ?? "DISTO";
}

export function isLaserConnected(): boolean {
  return Boolean(distanceChar && device?.gatt?.connected);
}

export function disconnectLaser() {
  try { device?.gatt?.disconnect(); } catch { /* noop */ }
  device = null;
  distanceChar = null;
}

// Wait for the next Float32 distance notification (typically the next
// laser shot the user triggers on the device). Times out to prevent
// hangs if the user cancels.
export function readNextDistanceMm(timeoutMs = 30_000): Promise<number> {
  if (!isLaserConnected()) return Promise.reject(new Error("Laser not connected"));
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => {
      const i = waiters.indexOf(fn);
      if (i >= 0) waiters.splice(i, 1);
      reject(new Error("Timed out waiting for laser reading"));
    }, timeoutMs);
    const fn = (mm: number) => { clearTimeout(t); resolve(mm); };
    waiters.push(fn);
  });
}