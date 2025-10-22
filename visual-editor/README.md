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

### Dettaglio attributi e vincoli di validazione

Il file `src/workflow-format.ts` espone l'elenco dei campi serializzati mentre il backend FastAPI li convalida tramite i modelli Pydantic in `backend/app/models.py`. Le tabelle seguenti riassumono i campi obbligatori e opzionali con le rispettive regole.

#### Metadata (`WorkflowMetadata`)

| Campo | Obbligatorio | Tipo | Note |
| --- | --- | --- | --- |
| `name` | Sì | string | Deve essere non vuota sia lato frontend che backend.【F:visual-editor/src/workflow-format.ts†L18-L28】【F:visual-editor/backend/app/models.py†L30-L57】 |
| `description` | No | string | Testo descrittivo libero. |
| `tags` | No | string[] | Il backend vieta valori vuoti o composti da spazi.【F:visual-editor/backend/app/models.py†L59-L63】 |
| `author` | No | oggetto | Se presente richiede `name` non vuoto e opzionalmente `email` valida.【F:visual-editor/backend/app/models.py†L12-L24】 |
| `externalId`, `createdAt`, `updatedAt` | No | string | Identificativi o timestamp ISO8601 opzionali.【F:visual-editor/src/workflow-format.ts†L26-L28】【F:visual-editor/backend/app/models.py†L41-L51】 |

#### Nodi (`WorkflowNodeDefinition`)

| Campo | Obbligatorio | Tipo | Note |
| --- | --- | --- | --- |
| `id` | Sì | string | Deve essere univoco all'interno del workflow.【F:visual-editor/src/workflow-format.ts†L41-L51】【F:visual-editor/backend/app/models.py†L100-L223】 |
| `kind` | Sì | `"input" \| "task" \| "output"` | Determina il ruolo logico del nodo.【F:visual-editor/src/workflow-format.ts†L11-L12】【F:visual-editor/backend/app/models.py†L103-L109】 |
| `label` | Sì | string | Etichetta non vuota mostrata nel canvas.【F:visual-editor/src/workflow-format.ts†L41-L51】【F:visual-editor/backend/app/models.py†L112-L117】 |
| `position` | Sì | `{ x: number; y: number; }` | Coordinate finite sul canvas React Flow.【F:visual-editor/src/workflow-format.ts†L31-L34】【F:visual-editor/backend/app/models.py†L66-L76】 |
| `data` | No | `Record<string, unknown>` | Payload serializzabile usato dall'esecutore; vedere sotto per `component` e `parameters`.

Per collegare i nodi a componenti Python si consiglia di usare un oggetto `data` con le seguenti convenzioni:

```json
{
  "component": "datapizza.modules.parsers.docling.DoclingParser",
  "parameters": { "json_output_dir": "./cache" }
}
```

- `data.component` contiene il percorso puntato alla classe eseguibile (modulo + nome) che risolve a un `PipelineComponent` o a un costruttore compatibile con i nodi del workflow.
- `data.parameters` è un dizionario opzionale con i parametri del costruttore. Il backend accetta qualsiasi struttura purché sia JSON serializzabile.【F:visual-editor/src/workflow-format.ts†L46-L50】【F:visual-editor/backend/app/models.py†L100-L117】 

#### Archi (`WorkflowEdgeDefinition`)

| Campo | Obbligatorio | Tipo | Note |
| --- | --- | --- | --- |
| `id` | Sì | string | Deve essere univoco per edge.【F:visual-editor/src/workflow-format.ts†L53-L59】【F:visual-editor/backend/app/models.py†L119-L223】 |
| `source` / `target` | Sì | `{ nodeId: string; portId?: string }` | `nodeId` non può essere vuoto e deve riferirsi a un nodo esistente; `portId` è opzionale.【F:visual-editor/src/workflow-format.ts†L36-L39】【F:visual-editor/backend/app/models.py†L79-L98】【F:visual-editor/backend/app/models.py†L225-L234】 |
| `label` | No | string | Etichetta opzionale non vuota.【F:visual-editor/backend/app/models.py†L119-L141】 |
| `metadata` | No | `Record<string, unknown>` | Informazioni aggiuntive custom.【F:visual-editor/src/workflow-format.ts†L53-L59】 |

#### Estensioni (`WorkflowDefinitionExtensions`)

| Campo | Obbligatorio | Tipo | Note |
| --- | --- | --- | --- |
| `reactFlow` | No | oggetto | Impostazioni dell'editor (viewport, UI) con campi aggiuntivi ammessi.【F:visual-editor/src/workflow-format.ts†L61-L80】【F:visual-editor/backend/app/models.py†L144-L175】 |
| `backend` | No | oggetto | Suggerimenti esecutivi personalizzati per il runtime.【F:visual-editor/src/workflow-format.ts†L72-L80】【F:visual-editor/backend/app/models.py†L166-L175】 |

#### Risultati di esecuzione (`WorkflowExecutionResult`)

L'esecutore mock restituisce un identificativo di run, lo stato aggregato e i dettagli passo-passo. Il campo `outputs` è un dizionario serializzabile che può contenere risultati strutturati (es. snapshot dei nodi o payload prodotti dai componenti Python).【F:visual-editor/src/workflow-format.ts†L136-L148】【F:visual-editor/backend/app/models.py†L244-L258】 I consumer dovrebbero mantenere chiavi stabili (ad esempio `nodeOutputs` o `artifacts`) per facilitare la re-idratazione lato frontend.

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


## Note operative
- Il visual editor deve rimanere **standalone** e non condividere configurazioni con il resto del repository.
- Aggiornare questo README ogni volta che vengono introdotte dipendenze o passaggi di setup aggiuntivi.

