# Agent Instructions for `visual-editor`

- Il progetto in questa directory **deve rimanere uno standalone Node/React app**. È vietato spostarlo in un monorepo JS condiviso o collegarlo a workspace pnpm/yarn/npm del repository principale.
- Ogni script di build o di sviluppo va mantenuto locale a questa cartella (ad es. `package.json`, `node_modules`, configurazioni Vite). Non creare configurazioni condivise nel root del repository che ne alterino l'autonomia.
- Quando si aggiorna lo scaffolding, assicurarsi che la commandistica documentata (`make visual-editor-dev`, `npm run dev`) continui a funzionare in modalità stand-alone.
- Aggiornare sempre questa documentazione se vengono introdotti nuovi vincoli per preservare l'indipendenza del progetto.
