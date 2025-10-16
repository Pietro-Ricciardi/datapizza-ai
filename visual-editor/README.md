# Datapizza Visual Editor

Interfaccia web dedicata alla creazione visuale dei workflow Datapizza. Il progetto vive come applicazione standalone all'interno di questa cartella e può essere sviluppato in autonomia rispetto al resto del repository.

## Setup iniziale

Il frontend è stato inizializzato con [Vite](https://vitejs.dev/) utilizzando il template **React + TypeScript**. La struttura generata fornisce un punto di partenza minimale con hot module replacement e tooling TypeScript già configurato.

### Requisiti
- Node.js >= 18
- npm (viene utilizzato per gli script locali)

### Installazione

```bash
npm install
```

### Avvio ambiente di sviluppo

```bash
npm run dev
```

Il server di Vite viene esposto in ascolto su `0.0.0.0` per poter essere raggiunto anche da container esterni.

### Build produzione

```bash
npm run build
```

Per visualizzare l'output della build è disponibile anche `npm run preview`.

## Roadmap prossimi step

Con il bootstrap completato, i prossimi passi prevedono:

1. Integrare una libreria di graph editing (es. React Flow) per rappresentare i workflow.
2. Definire lo store dell'applicazione (Zustand o alternativa) per la gestione dei nodi.
3. Modellare il formato dei workflow esportabili/importabili (JSON/YAML).
4. Preparare un backend leggero (FastAPI) per serializzazione, validazione ed esecuzione dei workflow.

## Note operative
- Il visual editor deve rimanere **standalone** e non condividere configurazioni con il resto del repository.
- Aggiornare questo README ogni volta che vengono introdotte dipendenze o passaggi di setup aggiuntivi.

