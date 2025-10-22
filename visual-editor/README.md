# Datapizza Visual Editor

Interfaccia web dedicata alla creazione visuale dei workflow Datapizza. Il progetto vive come applicazione standalone all'interno di questa cartella e può essere sviluppato in autonomia rispetto al resto del repository.

## Nuovo layout responsive

Il visual editor espone un layout a sezioni riutilizzabili: header compatto con azioni contestuali (export, cambio tema), canvas fluido che si adatta alle colonne disponibili e sidebar modulare basata su card componibili. Le colonne del main passano automaticamente da uno stack verticale su viewport ridotte a due colonne con larghezze variabili su breakpoint `>= 64rem`, `>= 80rem` e `>= 90rem`, così da garantire spazio extra alle anteprime del workflow e mantenere leggibile il pannello laterale. Le palette cromatiche, la tipografia e lo spacing sono governati da design token CSS e supportano sia la modalità chiara sia quella scura tramite toggle in header e media query.

### Story: revisione quotidiana della pipeline

1. L'owner del workflow apre l'editor in modalità chiara e utilizza il pulsante **Esporta workflow** nell'header compatto per condividere uno snapshot con il team.
2. Durante la standup, l'utente passa alla modalità scura con il toggle dedicato e monitora lo stato dei nodi nel pannello "Stato dei nodi", che evidenzia i badge di stato coerenti con la palette aggiornata.
3. Con i breakpoint desktop estesi il canvas occupa la colonna principale, mentre la sidebar modulare resta ancorata a destra e consente di lanciare una nuova esecuzione, consultare metadati e leggere l'output JSON formattato.

## Catalogo template e nodi preconfigurati

Il pulsante **Catalogo workflow** presente nell'header apre un drawer laterale con due funzionalità principali:

- **Workflow predefiniti**: raccolta di template ML, ETL e di orchestrazione che reimpostano il canvas con nodi, archi e metadati già pronti.
- **Nodi preconfigurati**: libreria drag & drop di input, task e output riutilizzabili con payload `component`/`parameters` già popolati.

### Avviare un workflow da template

1. Apri il catalogo e scegli un template (es. "Pipeline ML supervisionata").
2. Premi **Applica** per caricare il grafo nel canvas; l'opzione **Ricarica** ripristina il template corrente allo stato iniziale.
3. Il pannello laterale "Dettagli template" riporta categoria, autore, tag e descrizione del workflow attivo.

### Trascinare nodi preconfigurati

1. Con il catalogo aperto trascina un elemento della sezione "Nodi preconfigurati" sul canvas di React Flow.
2. Il nodo viene creato con label, tipologia (`input`, `task`, `output`) e configurazione `data` ereditati dal template.
3. Ogni rilascio genera un identificativo univoco (`node-id`, `node-id-1`, `node-id-2`, …) per evitare collisioni con i nodi esistenti.

### Aggiungere template personalizzati

Per ampliare la libreria modifica `src/data/workflow-templates.ts`:

1. Aggiungi un oggetto a `WORKFLOW_TEMPLATES` specificando `id`, `name`, `description`, `category`, `icon`, `definition` (nodi, archi, metadata) e opzionali `runtimeDefaults` (`environment`, `datasetUri`).
2. Inserisci eventuali nodi riutilizzabili in `NODE_TEMPLATES` assegnando la stessa `category` del workflow di riferimento e definendo `component`/`parameters` nel campo `data`.
3. Aggiorna `WORKFLOW_TEMPLATE_CATEGORIES` se vuoi introdurre nuove categorie o descrizioni.
4. Il drawer raggruppa automaticamente i nuovi elementi e li rende disponibili al drag & drop senza ulteriori modifiche.

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

### Backend FastAPI

Il backend vive in `visual-editor/backend` ed è pensato per essere avviato e testato in autonomia rispetto al frontend. Per evitarne la contaminazione con il resto del repository si consiglia di utilizzare un ambiente virtuale dedicato.

#### Requisiti Python

- Python 3.10 o superiore
- `pip`

#### Creazione dell'ambiente virtuale

```bash
cd visual-editor/backend
python -m venv .venv
source .venv/bin/activate  # Windows: .venv\\Scripts\\activate
pip install -r requirements.txt
```

Per includere anche gli strumenti di test installare il profilo esteso:

```bash
pip install -r requirements-dev.txt
```

#### Avvio del backend di sviluppo

```bash
cd visual-editor/backend
make dev
```

Il comando esegue `uvicorn app.main:app --reload` e rende disponibili gli endpoint documentati tramite Swagger UI su `http://127.0.0.1:8000/docs`.

#### Test backend

```bash
cd visual-editor/backend
pytest app/tests
```

La suite Python copre il loader dinamico e l'esecutore, verificando l'import dei componenti, la propagazione degli errori e la forma dei risultati normalizzati, oltre a un test d'integrazione che invoca i moduli Datapizza reali.【F:visual-editor/backend/app/tests/test_loader.py†L1-L120】【F:visual-editor/backend/app/tests/test_executor.py†L1-L132】【F:visual-editor/backend/app/tests/test_workflow_integration.py†L1-L46】

## Gestione dello stato con Zustand

Lo stato dell'editor (nodi, connessioni e relative trasformazioni) è centralizzato nello store definito in `src/store/workflow-store.ts`. Lo store espone azioni dedicate per l'inizializzazione del canvas, l'applicazione dei cambiamenti provenienti da React Flow e la creazione automatica di connessioni `smoothstep` animate. Questo approccio evita la duplicazione della logica di aggiornamento e rende più semplice estendere il workflow editor con pannelli di configurazione o controlli esterni al canvas.

### Pannello "Dettagli nodo"

La sidebar ospita un inspector contestuale che si attiva selezionando un nodo nel canvas. Il componente `NodeInspector` (`src/components/NodeInspector.tsx`) consente di modificare label, tipo logico e parametri JSON del nodo con validazione di base direttamente collegata allo store Zustand. Le azioni `updateNodeLabel`, `updateNodeKind` e `updateNodeParameters` mantengono l'immutabilità dello stato e garantiscono che la serializzazione (`src/workflow-serialization.ts`) produca sempre workflow coerenti con il formato supportato.

## Validazione in tempo reale del grafo

Lo store include ora uno stato di validazione (`validation`) che tiene traccia dei problemi correnti del workflow e viene aggiornato automaticamente ad ogni modifica di nodi, archi o metadati. Il modulo `src/services/workflow-validation.ts` analizza struttura del grafo e metadata producendo errori/avvisi, suggerendo quick-fix contestuali (es. creazione di connessioni mancanti, etichette di default, parametri placeholder) utilizzabili direttamente dalla sidebar.

- I nodi del canvas sono renderizzati tramite componenti dedicati (`src/components/ValidationNode.tsx`) e mostrano badge visivi con tooltip descrittivi in caso di warning/errori.
- La sezione "Validazione workflow" in `App.tsx` elenca i problemi in tempo reale, permette di applicare i quick-fix e mantiene l'integrazione con la validazione remota esposta dal backend FastAPI.
- La lista "Stato dei nodi" mette in evidenza eventuali criticità con badge dedicati per facilitare il monitoraggio durante l'esecuzione.

## Workflow graph con React Flow

L'applicazione monta un esempio di workflow di machine learning composto da nodi input, intermedi e output. È possibile interagire con il canvas utilizzando gli strumenti forniti da React Flow (mini-map, controlli di zoom e pan, connessioni animate). Il grafo iniziale coincide con il template `ml-standard-pipeline` definito in `src/data/workflow-templates.ts`, ma può essere sostituito scegliendo un template differente dal catalogo o aggiungendo nuove definizioni allo stesso file. L'inizializzazione dello store e l'esportazione del payload serializzato sono incapsulate nelle utility di `src/workflow-serialization.ts` (`initializeWorkflowStoreFromDefinition` e `serializeWorkflowFromStore`), che sfruttano i convertitori di `src/workflow-format.ts` per garantire la piena compatibilità con React Flow e con il backend previsto. `initializeWorkflowStoreFromDefinition` restituisce l'intero stato React Flow persistito nelle estensioni (viewport, pannelli, ecc.), mentre `serializeWorkflowFromStore` accetta un oggetto `reactFlow` opzionale per sovrascrivere o aggiungere nuove preferenze dell'interfaccia al momento dell'export.

## Esecuzione del workflow e integrazione con il backend mock

L'editor espone ora un pannello laterale dedicato all'esecuzione del workflow contro il backend FastAPI incluso in `backend/app`. Il componente React principale (`src/App.tsx`) permette di impostare ambiente runtime e riferimenti a risorse esterne, avvia l'esecuzione reale tramite il client `src/services/workflow-api.ts` e visualizza lo stato di ogni nodo insieme al payload di output restituito dall'esecutore. Lo store Zustand (`src/store/workflow-store.ts`) traccia run ID, errori, stati dei nodi e risultati normalizzati così da poter aggiornare l'interfaccia senza ricorrere a stato locale duplicato.

Per garantire la compatibilità con il loader Python viene introdotto `src/workflow-parameters.ts`, un set di utility per normalizzare i parametri dei nodi (mappe, set, date, URL e riferimenti a risorse esterne) in strutture JSON serializzabili. La funzione è utilizzata dalla serializzazione (`src/workflow-format.ts`) e resa disponibile ai componenti per creare riferimenti a risorse condivise (`createResourceReference`).

## Formato di esportazione/importazione dei workflow

Il visual editor espone un formato di serializzazione pensato per essere esportato in **JSON** o in **YAML** senza modifiche. La definizione è disponibile in `src/workflow-format.ts` ed è descritta dai seguenti elementi principali:

- `version`: identifica il formato supportato (`datapizza.workflow/v1`).
- `metadata`: informazioni contestuali sul workflow (nome, descrizione, autore con contatti, tag, categoria, icona, identificativo esterno, timestamp).
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
| `category` | No | string | Categoria logica usata dal catalogo (es. `ml`, `etl`, `orchestration`).【F:visual-editor/src/workflow-format.ts†L18-L33】 |
| `icon` | No | string | Emoji o icona mostrata nei cataloghi e nelle anteprime.【F:visual-editor/src/workflow-format.ts†L18-L33】 |
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

## Esportazione, importazione e validazione dal frontend

L'header dell'editor offre ora un menu **Esporta workflow** che genera file JSON o YAML pronti per essere condivisi. Il download sfrutta `URL.createObjectURL` per costruire al volo un blob con la serializzazione corrente, includendo viewport e metadati aggiornati.【F:visual-editor/src/App.tsx†L118-L182】【F:visual-editor/src/App.tsx†L974-L1000】

Lo stesso header mette a disposizione il pulsante **Importa workflow**, che apre un dialogo dedicato all'upload di definizioni `.json`, `.yaml` o `.yml`. Il file caricato viene migrato automaticamente alla versione supportata (`datapizza.workflow/v1`) tramite le utility di `workflow-serialization.ts`, che gestiscono i diversi formati legacy e normalizzano i tag o le label mancanti.【F:visual-editor/src/App.tsx†L183-L318】【F:visual-editor/src/workflow-serialization.ts†L14-L128】 Al termine dell'import lo store di Zustand viene re-inizializzato con `initializeWorkflowStoreFromDefinition` e la viewport del canvas viene ripristinata se presente nell'estensione `reactFlow`.【F:visual-editor/src/App.tsx†L318-L373】

Nel pannello laterale è stato introdotto il riquadro **Validazione workflow**. Il pulsante avvia un controllo contro l'endpoint FastAPI `/workflow/validate`; in caso di indisponibilità del backend l'editor effettua un fallback su un validatore locale che verifica campi obbligatori, duplicati e riferimenti agli ID dei nodi. L'esito viene mostrato con messaggi differenziati e l'elenco degli errori rilevati.【F:visual-editor/src/App.tsx†L318-L401】【F:visual-editor/src/App.tsx†L1002-L1052】【F:visual-editor/src/workflow-serialization.ts†L130-L185】

#### Risultati di esecuzione (`WorkflowExecutionResult`)

Il backend ora utilizza `DatapizzaWorkflowExecutor`, un motore che risolve dinamicamente i componenti Python del namespace `datapizza` e orchestra il ciclo `input → task → output` con gestione di timeout e log dedicati.【F:visual-editor/backend/app/executor.py†L1-L203】 Ogni nodo produce uno `step` con stato `completed` o `failed`; in caso di errori l'esecutore restituisce messaggi leggibili per facilitare il debug.【F:visual-editor/backend/app/executor.py†L37-L125】 Il campo `outputs` contiene `completedAt` e i risultati normalizzati dei nodi raggruppati per ruolo (`input`, `task`, `output`), pronti per essere serializzati e consumati dal frontend.【F:visual-editor/backend/app/executor.py†L167-L204】 I consumer dovrebbero mantenere chiavi stabili (ad esempio `nodeOutputs` o `artifacts`) per facilitare la re-idratazione lato frontend.

### Esempio JSON

```json
{
  "version": "datapizza.workflow/v1",
  "metadata": {
    "name": "ML Pipeline Demo",
    "description": "Esempio di pipeline di machine learning composto da fasi sequenziali.",
    "tags": ["demo", "ml"],
    "category": "ml",
    "icon": "🤖",
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

## Creare nuovi nodi compatibili con l'esecutore

Per aggiungere componenti custom da utilizzare nel visual editor è sufficiente rispettare alcune convenzioni condivise tra frontend e backend:

1. Esportare la classe o funzione nel namespace `datapizza.*` in modo che il loader possa importarla dinamicamente con sicurezza.【F:visual-editor/backend/app/runtime/loader.py†L20-L49】
2. Rendere il componente invocabile (funzione, classe con `__call__` oppure classe instanziabile) e accettare parametri sotto forma di mappatura; l'esecutore inietterà automaticamente `parameters`, `inputs`, `context` e `payload` quando presenti nella firma.【F:visual-editor/backend/app/runtime/loader.py†L74-L116】【F:visual-editor/backend/app/executor.py†L117-L161】
3. Restituire oggetti facilmente serializzabili: dizionari, liste, dataclass, modelli Pydantic o oggetti con metodo `.dict()`/`.model_dump()`. Qualsiasi altro tipo verrà convertito a stringa dal normalizzatore, quindi è consigliabile controllare a test che i dati risultanti rispettino il formato atteso dal frontend.【F:visual-editor/backend/app/runtime/loader.py†L51-L72】【F:visual-editor/backend/app/runtime/loader.py†L89-L110】
4. In caso di nuove dipendenze Python ricordarsi di aggiornarle nei requisiti del backend (runtime o dev) e di documentarle per mantenere l'app standalone.【F:visual-editor/backend/requirements.txt†L1-L13】【F:visual-editor/backend/requirements-dev.txt†L1-L2】

Seguendo queste regole i nodi aggiuntivi potranno essere orchestrati dal `DatapizzaWorkflowExecutor` senza interventi extra sul backend FastAPI.【F:visual-editor/backend/app/executor.py†L23-L204】 I test presenti nella cartella `backend/app/tests` forniscono esempi pratici su come serializzare i risultati e gestire errori di caricamento/invocazione.【F:visual-editor/backend/app/tests/test_loader.py†L1-L120】【F:visual-editor/backend/app/tests/test_executor.py†L1-L132】【F:visual-editor/backend/app/tests/test_workflow_integration.py†L1-L46】

## Note operative
- Il visual editor deve rimanere **standalone** e non condividere configurazioni con il resto del repository.
- Aggiornare questo README ogni volta che vengono introdotte dipendenze o passaggi di setup aggiuntivi.

