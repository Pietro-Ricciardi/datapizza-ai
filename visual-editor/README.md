# Datapizza Visual Editor

Interfaccia web dedicata alla creazione visuale dei workflow Datapizza. Il progetto vive come applicazione standalone all'interno di questa cartella e può essere sviluppato in autonomia rispetto al resto del repository.

## Setup iniziale

Il frontend è stato inizializzato con [Vite](https://vitejs.dev/) utilizzando il template **React + TypeScript**. La struttura generata fornisce un punto di partenza minimale con hot module replacement e tooling TypeScript già configurato. L'interfaccia include ora un canvas interattivo basato su [React Flow](https://reactflow.dev/) per la rappresentazione dei workflow.

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

## Workflow graph con React Flow

L'applicazione monta un esempio di workflow di machine learning composto da nodi input, intermedi e output. È possibile interagire con il canvas utilizzando gli strumenti forniti da React Flow (mini-map, controlli di zoom e pan, connessioni animate). Per personalizzare il grafo iniziale aggiornare l'oggetto `initialWorkflow` definito in `src/App.tsx`, che viene convertito in nodi e archi tramite le utility presenti in `src/workflow-format.ts`.

## Formato di esportazione/importazione dei workflow

Il visual editor espone un formato di serializzazione pensato per essere esportato in **JSON** o in **YAML** senza modifiche. La definizione è disponibile in `src/workflow-format.ts` ed è descritta dai seguenti elementi principali:

- `version`: identifica il formato supportato (`datapizza.workflow/v1`).
- `metadata`: informazioni contestuali sul workflow (nome, descrizione, autore, tag, timestamp).
- `nodes`: elenco dei nodi con tipo logico (`input`, `task`, `output`), posizione nel canvas, etichetta visuale e configurazioni specifiche (`data`).
- `edges`: collegamenti direzionali tra nodi con eventuali metadati (es. etichette, riferimenti a porte specifiche).

### Esempio JSON

```json
{
  "version": "datapizza.workflow/v1",
  "metadata": {
    "name": "ML Pipeline Demo",
    "description": "Esempio di pipeline di machine learning composto da fasi sequenziali.",
    "tags": ["demo", "ml"],
    "author": { "name": "Datapizza" },
    "createdAt": "2024-01-01T00:00:00.000Z"
  },
  "nodes": [
    {
      "id": "prepare",
      "kind": "task",
      "label": "Prepara dati",
      "position": { "x": 0, "y": 120 },
      "data": {
        "component": "datapizza.preprocessing.prepare",
        "parameters": { "strategy": "standardize" }
      }
    }
  ],
  "edges": [
    {
      "id": "e1",
      "source": { "nodeId": "start" },
      "target": { "nodeId": "prepare" }
    }
  ]
}
```

La versione YAML corrispondente si ottiene convertendo lo stesso payload mantenendo inalterata la struttura dei campi. Le utility `toReactFlowGraph` e `fromReactFlowGraph` permettono rispettivamente di trasformare un workflow serializzato nelle strutture richieste da React Flow e di generare l'oggetto esportabile a partire dallo stato attuale del canvas.

## Roadmap prossimi step

Con il bootstrap completato, i prossimi passi prevedono:

1. Definire lo store dell'applicazione (Zustand o alternativa) per la gestione dei nodi.
2. Modellare il formato dei workflow esportabili/importabili (JSON/YAML).
3. Preparare un backend leggero (FastAPI) per serializzazione, validazione ed esecuzione dei workflow.

## Note operative
- Il visual editor deve rimanere **standalone** e non condividere configurazioni con il resto del repository.
- Aggiornare questo README ogni volta che vengono introdotte dipendenze o passaggi di setup aggiuntivi.

