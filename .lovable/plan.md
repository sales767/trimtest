# Paritat amb we-measure.io — pla per fases

Aquest és un abast molt gran (setmanes de feina real). L'atacaré per fases, cadascuna en un torn separat, perquè puguis validar-ne el resultat abans de passar a la següent. Aquest missatge fixa la ruta; al final començo pel primer bloc.

## Decisions per defecte (canvieu-les si voleu abans que continuï)

- **Left/Right migration**: afegeixo `side` (`left`/`right`/`center`) i `point_index` a `line_specs` com a **nullables**. Els linemaps actuals queden com estan (side NULL = línia única, retrocompatible). Els models nous demanaran side/point_index.
- **Bluetooth làser**: **posposat** a la Fase 2b. Primer arribo a un flux manual + XLSX sòlid, després driver Leica DISTO amb feature-detect.
- **Estimates disclaimer**: banner persistent i discret a totes les vistes de simulació/resultat.
- **PDF/XLSX export**: client-side amb `jspdf` + `xlsx` (ja instal·lada per l'import).
- **RLS**: cada taula nova replica el patró existent (owner authenticated + admin override, anon només si sessió publicada).

## Fases i ordre d'execució

### Fase 1 — Esquema (aquest torn)
Una sola migració que afegeix:
- `line_specs.side` (enum nullable), `line_specs.point_index` (int nullable).
- `wings`: `production_date`, `purchase_date`, `first_flight_date`, `wing_hours`, `line_set_hours`, `serial_checksum_valid` (bool), i flag `locked_fields` per fer read-only després del primer desat.
- `wing_models`: `brake_measurement_supported` (bool), `safety_notice` (text).
- Nova taula `wing_loop_state` (wing_id, line_spec_id, loop_type_id).
- `measurement_sessions`: `measurement_order` (enum rows/columns/sections), `includes_brakes`, `tolerance_override_mm`, `offset_mm`, `comment`, `publish_anonymously`, `previous_session_id`.
- Noves taules: `session_loop_changes`, `line_inserts`, `cascade_loop_changes`.
- `measurements`: `flagged`, `flag_reason`.
- `profiles`: `laser_offset_mm`, `preferred_measurement_order`, `default_tolerance_mm`.
- RLS + GRANTs per a totes les taules noves.

### Fase 2 — Captura reforçada
- Camps de setup de sessió (order, brakes, tolerance override, offset, comment, anonymous).
- Auto-advance de focus segons `measurement_order`.
- Import XLSX (parseig + preview + commit).
- Editor de `wing_loop_state` i auto-import a sessió nova.
- Metadades read-once de wing.

### Fase 2b — Bluetooth làser
- Driver interface pluggable, implementació Leica DISTO BLE, feature-detect Web Bluetooth, mode "laser on, discard implausible".

### Fase 3 — Plausibilitat i review
- Fórmula de desviació relativa per grup, flag automàtic al desar mesura (trigger o dins `upsertMeasurement`).
- Review dialog: agrupa per grup, re-read per línia, gate "continue to simulation" a zero flags.

### Fase 4 — Simulació AoI + simetria
- Diagrama SVG per grup de línies, coloració per desviació, banda de tolerància ajustable.
- Toggle Symmetry (relatiu a la mediana).
- Modes de referència: main-line / row / point.
- Simulació interactiva de loops amb reset i marques (installed / candidate).

### Fase 5 — Finish flow + comparativa + re-measure
- Finish dialog (comment, anonymous, 3 sí/no) que escriu `session_loop_changes` + opcionalment sincronitza `wing_loop_state`.
- Re-measure parcial: nova sessió amb `previous_session_id`, copiant les línies no re-mesurades.
- Result page (AoI/symmetry, breadcrumb per wing history).
- Comparativa antic vs. nou (recorre la cadena `previous_session_id`), export PDF/XLSX, share link.
- Taula raw nominal vs measured al peu.

### Fase 6 — Wing/Model admin
- Wing detail: safety_notice, hores/dates read-once, editor Loops fora de sessió.
- Model admin: brake_measurement_supported, safety_notice editable.
- Checksum de serial + producció + badge "not validated".

### Fase 7 — Contingut i comunitat
- Rutes estàtiques: Vision, Manual (accordion), FAQ.
- Account settings: laser offset, preferred order, default tolerance.
- Public feed anonimitzat de sessions publicades.

## Detalls tècnics (referència)

- **Migració Fase 1**: una única sentència SQL amb tots els CREATE/ALTER + GRANT + RLS. Els enums nous es creen amb `CREATE TYPE ... AS ENUM`. `serial_checksum_valid` es calcula amb un trigger `BEFORE INSERT/UPDATE` sobre `wings`.
- **Loop suggestion engine** (ja existent a Fase 0): es preserva; només s'estén perquè `wing_loop_state` alimenti l'estat "installed" per defecte.
- **Fórmula plausibilitat**: `diff_N = (reading_N - nominal_N) - (reading_ref - nominal_ref)`; `flagged = |diff_N| > 4 × tolerance_effectiva`.
- **AoI**: per grup, es projecta cada punt sobre un eix normalitzat i es dibuixa el desplaçament horitzontal proporcional a `deviation_mm`.
- **Export**: `jspdf` + `jspdf-autotable` per PDF, `xlsx` (SheetJS) per Excel — tot client-side.
- **Web Bluetooth**: `navigator.bluetooth.requestDevice({ filters: [{ services: [<uuid>] }] })` amb driver Leica; feature-detect `if (!('bluetooth' in navigator))` desactiva la UI.
- **Estat read-once**: el server rebutja updates a camps ja poblats (validat a `wings.functions.ts`).

## Riscos / notes

- És molta feina. Cada fase és un torn (o més). Si em toca fer-ho tot d'una tirada sense poder validar entremig, algun detall d'UX quedarà a mig polir i el tornarem a tocar.
- Bluetooth requereix maquinari real per validar; el codi quedarà preparat però no puc testejar end-to-end sense un DISTO davant.
- Les vistes AoI/symmetry són el bloc més subjectiu; probablement les iterem visualment un cop les vegis.

Començo ara mateix amb la Fase 1 (migració d'esquema). Un cop l'aprovis i s'apliqui, seguiré amb Fase 2 al torn següent, i així fins al final.
