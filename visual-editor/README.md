# Datapizza Visual Editor

Interfaccia web dedicata alla creazione visuale dei workflow Datapizza. Il progetto vive come applicazione standalone all'interno di questa cartella e può essere sviluppato in autonomia rispetto al resto del repository.

## Setup iniziale

Il frontend è stato inizializzato con [Vite](https://vitejs.dev/) utilizzando il template **React + TypeScript**. La struttura generata fornisce un punto di partenza minimale con hot module replacement e tooling TypeScript già configurato. L'interfaccia include ora un canvas interattivo basato su [React Flow](https://reactflow.dev/) per la rappresentazione dei workflow e uno store condiviso costruito con [Zustand](https://zustand-demo.pmnd.rs/) per governare nodi e connessioni.

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

### Test unitari

```bash
npm run test
```

La suite utilizza [Vitest](https://vitest.dev/) per verificare la serializzazione dei workflow e la compatibilità con React Flow.

## Gestione dello stato con Zustand

Lo stato dell'editor (nodi, connessioni e relative trasformazioni) è centralizzato nello store definito in `src/store/workflow-store.ts`. Lo store espone azioni dedicate per l'inizializzazione del canvas, l'applicazione dei cambiamenti provenienti da React Flow e la creazione automatica di connessioni `smoothstep` animate. Questo approccio evita la duplicazione della logica di aggiornamento e rende più semplice estendere il workflow editor con pannelli di configurazione o controlli esterni al canvas.

## Workflow graph con React Flow

L'applicazione monta un esempio di workflow di machine learning composto da nodi input, intermedi e output. È possibile interagire con il canvas utilizzando gli strumenti forniti da React Flow (mini-map, controlli di zoom e pan, connessioni animate). Per personalizzare il grafo iniziale aggiornare l'oggetto `initialWorkflow` definito in `src/App.tsx`. L'inizializzazione dello store e l'esportazione del payload serializzato sono incapsulate nelle utility di `src/workflow-serialization.ts` (`initializeWorkflowStoreFromDefinition` e `serializeWorkflowFromStore`), che sfruttano i convertitori di `src/workflow-format.ts` per garantire la piena compatibilità con React Flow e con il backend previsto. `initializeWorkflowStoreFromDefinition` restituisce l'intero stato React Flow persistito nelle estensioni (viewport, pannelli, ecc.), mentre `serializeWorkflowFromStore` accetta un oggetto `reactFlow` opzionale per sovrascrivere o aggiungere nuove preferenze dell'interfaccia al momento dell'export.

## Formato di esportazione/importazione dei workflow

Il visual editor espone un formato di serializzazione pensato per essere esportato in **JSON** o in **YAML** senza modifiche. La definizione è disponibile in `src/workflow-format.ts` ed è descritta dai seguenti elementi principali:

- `version`: identifica il formato supportato (`datapizza.workflow/v1`).
- `metadata`: informazioni contestuali sul workflow (nome, descrizione, autore con contatti, tag, identificativo esterno, timestamp).
- `nodes`: elenco dei nodi con tipo logico (`input`, `task`, `output`), posizione nel canvas, etichetta visuale e configurazioni specifiche (`data`).
- `edges`: collegamenti direzionali tra nodi con eventuali metadati (es. etichette, riferimenti a porte specifiche).
- `extensions`: spazio opzionale per impostazioni di frontend e backend. Le estensioni correnti includono `reactFlow` (viewport, stato pannelli, preferenze di snapping) per ripristinare l'interfaccia e `backend` per passare suggerimenti all'esecutore.

### Esempio JSON

```json
{
  "version": "datapizza.workflow/v1",
  "metadata": {
    "name": "ML Pipeline Demo",
    "description": "Esempio di pipeline di machine learning composto da fasi sequenziali.",
    "tags": ["demo", "ml"],
    "author": { "name": "Datapizza", "email": "editor@datapizza.ai" },
    "externalId": "wf-demo-001",
    "createdAt": "2024-01-01T00:00:00.000Z",
    "updatedAt": "2024-01-15T12:34:56.000Z"
  },
  "nodes": [
    {
      "id": "start",
      "kind": "input",
      "label": "Origine",
      "position": { "x": 0, "y": 0 },
      "data": {
        "component": "datapizza.source.dataset",
        "parameters": { "name": "customers" }
      }
    },
    {
      "id": "prepare",
      "kind": "task",
      "label": "Prepara dati",
      "position": { "x": 0, "y": 120 },
      "data": {
        "component": "datapizza.preprocessing.prepare",
        "parameters": { "strategy": "standardize" }
      }
    },
    {
      "id": "deploy",
      "kind": "output",
      "label": "Deploy",
      "position": { "x": 0, "y": 360 },
      "data": {
        "component": "datapizza.deployment.push",
        "parameters": { "environment": "staging" }
      }
    }
  ],
  "edges": [
    {
      "id": "e1",
      "source": { "nodeId": "start", "portId": "out" },
      "target": { "nodeId": "prepare", "portId": "in" },
      "label": "dataset",
      "metadata": { "optional": false }
    },
    {
      "id": "e2",
      "source": { "nodeId": "prepare" },
      "target": { "nodeId": "deploy" }
    }
  ],
  "extensions": {
    "reactFlow": {
      "viewport": { "x": 80, "y": 40, "zoom": 1.1 },
      "sidebarOpen": true,
      "inspectorTab": "preview"
    },
    "backend": {
      "queue": "ml-default"
    }
  }
}
```

### Esempio YAML

```yaml
version: datapizza.workflow/v1
metadata:
  name: ML Pipeline Demo
  description: Esempio di pipeline di machine learning composto da fasi sequenziali.
  tags:
    - demo
    - ml
  author:
    name: Datapizza
    email: editor@datapizza.ai
  externalId: wf-demo-001
  createdAt: "2024-01-01T00:00:00.000Z"
  updatedAt: "2024-01-15T12:34:56.000Z"
nodes:
  - id: start
    kind: input
    label: Origine
    position:
      x: 0
      y: 0
    data:
      component: datapizza.source.dataset
      parameters:
        name: customers
  - id: prepare
    kind: task
    label: Prepara dati
    position:
      x: 0
      y: 120
    data:
      component: datapizza.preprocessing.prepare
      parameters:
        strategy: standardize
  - id: deploy
    kind: output
    label: Deploy
    position:
      x: 0
      y: 360
    data:
      component: datapizza.deployment.push
      parameters:
        environment: staging
edges:
  - id: e1
    source:
      nodeId: start
      portId: out
    target:
      nodeId: prepare
      portId: in
    label: dataset
    metadata:
      optional: false
  - id: e2
    source:
      nodeId: prepare
    target:
      nodeId: deploy
extensions:
  reactFlow:
    viewport:
      x: 80
      y: 40
      zoom: 1.1
    sidebarOpen: true
    inspectorTab: preview
  backend:
    queue: ml-default
```

Le utility `toReactFlowGraph` e `fromReactFlowGraph` garantiscono la compatibilità con React Flow, mentre `serializeWorkflowFromStore` e `initializeWorkflowStoreFromDefinition` gestiscono la conversione diretta dello stato di `useWorkflowStore`. Per estendere lo schema:

1. Aggiornare le interfacce TypeScript in `src/workflow-format.ts`, mantenendo i nuovi campi serializzabili.
2. Propagare le nuove proprietà alle utility di conversione (incluso `src/workflow-serialization.ts`).
3. Documentare le modifiche aggiornando esempi JSON/YAML e test correlati.

## Backend FastAPI per import/export

Per sperimentare l'integrazione con Datapizza AI è disponibile un backend leggero
in `visual-editor/backend/` che espone endpoint REST di validazione ed
esecuzione mock dei workflow.

### Requisiti backend

- Python >= 3.10

### Installazione dipendenze

```bash
cd backend
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
```

### Avvio server FastAPI

```bash
uvicorn app.main:app --reload
```

È disponibile anche un target `make dev` nella directory `backend/` che
avvia `uvicorn` con le stesse opzioni.

Il server viene esposto per default su `http://127.0.0.1:8000`. In ambiente di
sviluppo è possibile configurare `uvicorn` con l'opzione `--host 0.0.0.0` per
consentire l'accesso dal frontend in esecuzione all'interno di container.

### Endpoint disponibili

- `GET /workflow/schema`: restituisce lo schema JSON del formato supportato.
- `POST /workflow/validate`: valida un workflow e ritorna l'esito con elenco
  degli eventuali problemi riscontrati.
- `POST /workflow/import`: normalizza e restituisce il workflow ricevuto dal
  frontend.
- `POST /workflow/export`: consente di serializzare un workflow prima di
  persisterlo o inviarlo ad altri servizi.
- `POST /workflow/execute`: esegue un run mock tramite il motore integrato e
  restituisce una traccia dei nodi eseguiti.

Ogni endpoint accetta e restituisce payload coerenti con le interfacce
TypeScript presenti in `src/workflow-format.ts`. La validazione server-side
assicurata dai modelli Pydantic evita la propagazione di workflow inconsistenti
verso servizi esterni. Oltre alla definizione del workflow, il file esporta
anche i tipi `WorkflowValidationResponse`, `WorkflowExecutionResult` e
`WorkflowSchemaResponse` che descrivono le risposte fornite dagli endpoint di
validazione, esecuzione e introspezione dello schema.

## Roadmap prossimi step

Con il bootstrap completato, i prossimi passi prevedono:

1. ~~Definire lo store dell'applicazione (Zustand o alternativa) per la gestione dei nodi.~~ Completato con `useWorkflowStore` basato su Zustand.
2. Modellare il formato dei workflow esportabili/importabili (JSON/YAML).
3. ~~Preparare un backend leggero (FastAPI) per serializzazione, validazione ed esecuzione dei workflow.~~ Completato con l'applicazione FastAPI in `visual-editor/backend/`.

## Note operative
- Il visual editor deve rimanere **standalone** e non condividere configurazioni con il resto del repository.
- Aggiornare questo README ogni volta che vengono introdotte dipendenze o passaggi di setup aggiuntivi.

