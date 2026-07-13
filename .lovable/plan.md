
# Niviuk Measure — Pla per fases

Eina interna Niviuk per mesurar veles al taller: base de dades de models amb valors de fàbrica, sessions de mesura per número de sèrie, comparació valor real vs fàbrica amb desviacions, i protocols exportables.

L'entrego per fases perquè és una app amb força volum. Cada fase queda funcional i validable abans de passar a la següent.

## Stack

- TanStack Start + React + Tailwind + shadcn (ja al template)
- Lovable Cloud (Postgres + Auth): login email/password per tècnics
- Tot el CRUD via `createServerFn` amb RLS

Sense Web Bluetooth de moment — camps numèrics per introduir mesures.

## Model de dades

```text
profiles           id (=auth.users), full_name, role
user_roles         user_id, role (admin | technician)  -- taula separada
wing_models        id, brand, name, size, cells, notes  (Niviuk Artik, Klimber, etc.)
line_specs         id, model_id, group (A/B/C/D/BR), row (1..n), 
                   label (A1, A2, BR1...), factory_length_mm, tolerance_mm
wings              id, model_id, serial_number, owner_note, created_by
measurement_sessions  id, wing_id, technician_id, session_date, 
                      status (draft|complete|published), share_token, checksum, notes
measurements       id, session_id, line_spec_id, measured_mm, deviation_mm
```

RLS: tècnics veuen totes les veles/models Niviuk internament; només poden editar les seves sessions en draft. Admins tot.

## Fase 1 — Fonaments (aquest entregable)

1. Disseny visual Niviuk (paleta blau/blanc neta, tipografia tècnica, no els mountains de we-measure).
2. Auth email/password + Google (ruta pública `/auth`, layout `_authenticated` gestionat).
3. Home autenticada amb navegació: Tauler, Models, Mesures, Nova mesura, Manual, FAQ.
4. Landing pública `/` amb intro Niviuk + botó Entra.
5. Esquema DB complet + RLS + trigger crear profile.
6. Pàgina **Models de vela**: llista + crea/edita model + gestor de línies (A1..BR6 amb longitud fàbrica).
7. Importador CSV per un model (format: `label,factory_length_mm,tolerance_mm`).
8. Ruta `/models/$id` amb graella de línies estil we-measure (targetes AR1/AR2/BR1... amb valors de fàbrica).

## Fase 2 — Mesura i comparació

9. CRUD veles (número de sèrie associat a model).
10. Nova sessió de mesura: replicar la graella de la vela, cada línia amb input numèric.
11. Càlcul en viu de desviació (mm i %) vs fàbrica, semàfor de color segons tolerància.
12. Resum de sessió: mitjana desviació per grup (A/B/C/BR), gràfic de desviacions.
13. Guardar draft / marcar completa.

## Fase 3 — Protocols i compartició

14. Vista pública `/share/result/$token` (només lectura, sense login).
15. Export PDF del protocol.
16. Comparació pre/post (dues sessions de la mateixa vela una al costat de l'altra).
17. Històric de la vela: evolució de mesures en el temps.

## Fase 4 — Opcional més endavant

- Integració làser Bluetooth (Web Bluetooth API).
- Simulació de trimming.
- Comparació entre veles públiques de la comunitat.

---

**En aquesta iteració construeixo la Fase 1 sencera.** Un cop la validis passem a la Fase 2. Vols que arrenqui?
