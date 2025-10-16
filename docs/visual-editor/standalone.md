# Decisione: Visual Editor standalone

- **Stato**: Approvata (2024-05-17)
- **Contesto**: Il visual editor offre un'esperienza di sviluppo React/TypeScript distinta dal core Python del framework Datapizza.
- **Decisione**: Il progetto del visual editor rimane completamente autonomo. Non deve essere inserito in un workspace JavaScript condiviso (`pnpm`, `npm`, `yarn`) né deve condividere configurazioni di build con il resto del repository.
- **Motivazioni**:
  - Evitare dipendenze incrociate che aumenterebbero la complessità di release del framework core.
  - Consentire cicli di rilascio indipendenti per l'interfaccia visuale.
  - Ridurre l'impatto sulle pipeline CI/CD Python esistenti.
- **Conseguenze**:
  - Gli script di sviluppo e build vivono dentro `visual-editor/`.
  - Il target `make visual-editor-dev` prepara l'ambiente eseguendo i comandi nella cartella dedicata senza introdurre side-effect nel resto del repo.
  - Nuove dipendenze JavaScript non devono essere referenziate da altre parti del repository.
