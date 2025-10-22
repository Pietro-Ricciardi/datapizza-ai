# Backend FastAPI del visual editor

Il backend in `visual-editor/backend/app` espone gli endpoint di import, validazione ed esecuzione descritti in `main.py`, inclusa l'invocazione del nuovo `DatapizzaWorkflowExecutor`. I payload sono validati con i modelli Pydantic definiti in `models.py`, garantendo le stesse regole applicate dal frontend TypeScript (`visual-editor/src/workflow-format.ts`).【F:visual-editor/backend/app/main.py†L9-L161】【F:visual-editor/backend/app/models.py†L30-L343】【F:visual-editor/src/workflow-format.ts†L18-L148】

## Setup locale

### Ambiente virtuale

```bash
cd visual-editor/backend
python -m venv .venv
source .venv/bin/activate  # Windows: .venv\\Scripts\\activate
pip install -r requirements.txt
```

Per includere gli strumenti di sviluppo (pytest) installare il profilo esteso:

```bash
pip install -r requirements-dev.txt
```

### Avvio del server di sviluppo

```bash
make dev
```

Il comando esegue `uvicorn app.main:app --reload` mantenendo la natura standalone del progetto.【F:visual-editor/backend/Makefile†L1-L4】

### Suite di test

```bash
pytest app/tests
```

I test coprono il loader dinamico (`resolve_component`, `normalise_parameters`, `normalise_result`), la gestione degli errori dell'esecutore e un caso di integrazione reale che invoca `datapizza.modules.parsers.text_parser.parse_text` per validare il parsing di nodi `Node` restituiti dai moduli core.【F:visual-editor/backend/app/tests/test_loader.py†L1-L120】【F:visual-editor/backend/app/tests/test_executor.py†L1-L132】【F:visual-editor/backend/app/tests/test_workflow_integration.py†L1-L36】 La suite richiede l'installazione delle dipendenze Datapizza presenti in `requirements.txt` e degli strumenti di test definiti in `requirements-dev.txt`.

## Configurazione runtime

`app/settings.py` introduce `AppSettings`, un sistema di configurazione basato su Pydantic `BaseSettings` che centralizza la risoluzione di percorsi, variabili d'ambiente e credenziali usate dai moduli Datapizza.【F:visual-editor/backend/app/settings.py†L1-L153】 Le variabili possono essere definite in un file `.env` oppure tramite ambiente e includono:

- `DATAPIZZA_COMPONENT_PATHS`: percorsi aggiuntivi (separati da `:`) inseriti in `sys.path` all'avvio del server.
- `DATAPIZZA_ENVIRONMENT_VARIABLES` e `DATAPIZZA_CREDENTIALS`: dizionari JSON con coppie chiave/valore impostate nell'ambiente di processo.
- `DATAPIZZA_RUNTIME_ENVIRONMENTS`: dizionario JSON che mappa un nome di ambiente (`dev`, `staging`, ...) a profili con percorsi, variabili e credenziali specifiche.
- `DATAPIZZA_EXECUTOR_NODE_TIMEOUT` e `DATAPIZZA_EXECUTOR_MAX_WORKERS`: parametri usati per inizializzare l'esecutore reale.
- `DATAPIZZA_EXECUTOR_MODE`: feature flag che commuta tra esecuzione locale (`mock`, default) e inoltro remoto (`remote`).【F:visual-editor/backend/app/settings.py†L42-L107】【F:visual-editor/backend/app/main.py†L74-L113】
- `DATAPIZZA_REMOTE_EXECUTOR_URL`, `DATAPIZZA_REMOTE_EXECUTOR_TIMEOUT` e `DATAPIZZA_REMOTE_EXECUTOR_HEADERS`: endpoint REST, timeout (secondi) e intestazioni aggiuntive usati quando l'esecuzione è delegata a un servizio esterno Datapizza.【F:visual-editor/backend/app/settings.py†L42-L115】【F:visual-editor/backend/app/main.py†L74-L113】

L'applicazione invoca `configure_base_environment()` in fase di startup per applicare i percorsi e le variabili globali una sola volta.【F:visual-editor/backend/app/main.py†L43-L51】【F:visual-editor/backend/app/settings.py†L96-L102】

### Modalità esecutore e feature flag

`AppSettings.executor_mode` abilita lo switch fra due percorsi di esecuzione controllati.【F:visual-editor/backend/app/settings.py†L42-L115】【F:visual-editor/backend/app/main.py†L74-L113】 Con `mock` (default) viene istanziato `DatapizzaWorkflowExecutor`, che carica dinamicamente i componenti Python locali, traccia i tempi di ogni nodo e produce un risultato compatibile con l'editor.【F:visual-editor/backend/app/executor.py†L44-L236】 Impostando `DATAPIZZA_EXECUTOR_MODE=remote` l'API costruisce un `RemoteWorkflowExecutor` che inoltra il workflow a un endpoint configurabile (`DATAPIZZA_REMOTE_EXECUTOR_URL`) usando `httpx`, propagando eventuali intestazioni personalizzate e timeout.【F:visual-editor/backend/app/executor.py†L238-L330】【F:visual-editor/backend/app/main.py†L74-L113】 Entrambe le modalità rispettano lo stesso schema di `WorkflowExecutionResult`, così il frontend non richiede modifiche.

### Opzioni runtime per `/workflow/execute`

L'endpoint di esecuzione accetta ora sia il payload storico (solo il workflow) sia un oggetto strutturato `{ "workflow": ..., "options": ... }`. Il campo `options` segue il modello `WorkflowRuntimeOptions` e consente di specificare profili nominati (`environment`), percorsi addizionali, variabili/credenziali temporanee e override di configurazione che vengono serializzati in `DATAPIZZA_RUNTIME_CONFIG_OVERRIDES` per essere letti dai componenti Python.【F:visual-editor/backend/app/main.py†L113-L138】【F:visual-editor/backend/app/models.py†L267-L319】【F:visual-editor/backend/app/settings.py†L110-L153】 Il risultato di esecuzione include le informazioni runtime effettivamente utilizzate nel campo `outputs.runtime` per facilitare il debug lato frontend.【F:visual-editor/backend/app/main.py†L132-L138】

## Dipendenze Python

Il file `requirements.txt` contiene ora, oltre a FastAPI e Pydantic, le librerie richieste dal backend (inclusi `httpx` per l'esecutore remoto e `structlog` per il logging strutturato) e i pacchetti Datapizza necessari per eseguire realmente i workflow orchestrati dal visual editor (core, parser, reranker, tool e vectorstore).【F:visual-editor/backend/requirements.txt†L1-L20】 Installarli con `pip install -r requirements.txt` garantisce la disponibilità dei componenti Python caricati dall'esecutore senza dover configurare manualmente i singoli moduli.

## Osservabilità

Il backend inizializza `structlog` con output JSON e registra metriche OpenTelemetry a ogni richiesta, esportandole periodicamente sulla console tramite `ConsoleMetricExporter`.【F:visual-editor/backend/app/observability.py†L1-L110】【F:visual-editor/backend/app/main.py†L43-L65】 `DatapizzaWorkflowExecutor` emette eventi strutturati per l'avvio, la conclusione e gli errori di ogni nodo e aggiorna tre metriche chiave: conteggio delle esecuzioni, durata complessiva e distribuzione dei tempi per step, oltre al contatore degli errori.【F:visual-editor/backend/app/executor.py†L44-L236】 Gli stessi strumenti vengono riutilizzati dal `RemoteWorkflowExecutor` per tracciare le chiamate HTTP delegate, includendo dettagli sull'esito remoto e gli eventuali status code ricevuti.【F:visual-editor/backend/app/executor.py†L238-L330】 In questo modo, a parità di configurazione, si possono confrontare i tempi ottenuti in modalità mock e remote e inviare i dati a pipeline di osservabilità esterne configurando un diverso exporter OpenTelemetry.

## Procedure di deploy e fallback

1. **Abilitare l'esecuzione remota**: definire `DATAPIZZA_EXECUTOR_MODE=remote` e popolare `DATAPIZZA_REMOTE_EXECUTOR_URL` (eventualmente `..._TIMEOUT` e `..._HEADERS`) nello stack di deploy. Al riavvio, l'API costruisce un esecutore remoto memorizzato in cache che inoltra i workflow all'endpoint specificato.【F:visual-editor/backend/app/settings.py†L42-L115】【F:visual-editor/backend/app/main.py†L74-L113】 Monitorare i log JSON prodotti da `RemoteWorkflowExecutor` per verificare gli status code e gli eventuali errori di rete.【F:visual-editor/backend/app/executor.py†L238-L330】 Le metriche OpenTelemetry permettono di confrontare latenza locale vs remota e di alimentare dashboard di osservabilità.【F:visual-editor/backend/app/observability.py†L1-L110】
2. **Ripristinare il mock executor**: impostare `DATAPIZZA_EXECUTOR_MODE=mock` (o rimuovere l'override) e riavviare il processo. L'app ritorna a `DatapizzaWorkflowExecutor`, mantenendo invariati endpoint e schema di risposta, così il frontend non necessita di modifiche. Le variabili `DATAPIZZA_REMOTE_EXECUTOR_*` possono restare definite ma vengono ignorate quando il flag è su `mock`, facilitando rollback rapidi in caso di regressioni.【F:visual-editor/backend/app/main.py†L74-L113】【F:visual-editor/backend/app/executor.py†L44-L236】 Anche in questa modalità continuano a essere emessi log/metriche strutturate utili per validare il corretto funzionamento prima di un nuovo cutover.

## Mapping nodi → componenti Python

| kind | Convenzione `data.component` | Tipo di risultato previsto | Serializzazione consigliata |
| --- | --- | --- | --- |
| `input` | `datapizza.modules.parsers.<provider>.<Classe>` oppure `datapizza.modules.treebuilder.<Classe>`【F:datapizza-ai-core/datapizza/modules/parsers/__init__.py†L1-L6】【F:datapizza-ai-core/datapizza/modules/treebuilder/__init__.py†L1-L4】 | Oggetti `Node` che rappresentano alberi documentali.【F:datapizza-ai-core/datapizza/type/type.py†L353-L424】 | Convertire ricorsivamente in dizionari con `node.node_type.value`, `node.metadata` e `children`, quindi restituire nel campo `outputs` del `WorkflowExecutionResult` (es. `outputs.nodeOutputs[nodeId]`).【F:visual-editor/src/workflow-format.ts†L136-L148】 |
| `task` | `datapizza.modules.splitters.*`, `datapizza.modules.captioners.LLMCaptioner`, `datapizza.modules.metatagger.KeywordMetatagger`, `datapizza.modules.rerankers.*`, `datapizza.modules.prompt.*`, `datapizza.modules.rewriters.ToolRewriter`【F:datapizza-ai-core/datapizza/modules/splitters/__init__.py†L1-L11】【F:datapizza-ai-core/datapizza/modules/captioners/__init__.py†L1-L4】【F:datapizza-ai-core/datapizza/modules/metatagger/__init__.py†L1-L4】【F:datapizza-ai-modules/rerankers/cohere/datapizza/modules/rerankers/cohere/__init__.py†L1-L4】【F:datapizza-ai-modules/rerankers/together/datapizza/modules/rerankers/together/__init__.py†L1-L4】【F:datapizza-ai-core/datapizza/modules/prompt/__init__.py†L1-L4】【F:datapizza-ai-core/datapizza/modules/rewriters/__init__.py†L1-L4】 | Varia a seconda del modulo: liste di `Chunk`, `Node` aggiornati, stringhe, oggetti `Memory`.【F:datapizza-ai-core/datapizza/modules/splitters/text_splitter.py†L27-L61】【F:datapizza-ai-core/datapizza/modules/captioners/llm_captioner.py†L100-L164】【F:datapizza-ai-core/datapizza/modules/metatagger/keyword_metatagger.py†L38-L86】【F:datapizza-ai-modules/rerankers/cohere/datapizza/modules/rerankers/cohere/cohere_reranker.py†L66-L138】【F:datapizza-ai-core/datapizza/modules/prompt/prompt.py†L34-L96】【F:datapizza-ai-core/datapizza/modules/rewriters/tool_rewriter.py†L38-L93】 | Serializzare `Chunk` come dict (`id`, `text`, `metadata`, `embeddings` se presenti), i `Node` come descritto per gli input, le stringhe direttamente e le `Memory` con `memory.to_dict()`.【F:datapizza-ai-core/datapizza/type/type.py†L467-L492】【F:datapizza-ai-core/datapizza/memory/memory.py†L45-L200】 Inserire i risultati nel campo `outputs` usando chiavi esplicite (es. `taskOutputs`). |
| `output` | `datapizza.pipeline.IngestionPipeline` per orchestrare componenti e `datapizza.vectorstores.<provider>.<Classe>` per la persistenza (es. `datapizza.vectorstores.qdrant.QdrantVectorstore`).【F:datapizza-ai-core/datapizza/pipeline/pipeline.py†L34-L200】【F:datapizza-ai-vectorstores/datapizza-ai-vectorstores-qdrant/datapizza/vectorstores/qdrant/qdrant_vectorstore.py†L19-L200】 | Operazioni di persistenza o recupero su collezioni di `Chunk`; le pipeline possono restituire `Chunk[]` se nessun vector store è configurato.【F:datapizza-ai-core/datapizza/pipeline/pipeline.py†L61-L134】 | Confermare l’esito in `outputs` (es. `{"collection": ..., "stored": n}`) e serializzare eventuali `Chunk` come sopra. Le risposte di ricerca possono essere inviate al frontend sotto `outputs.retrieval` mantenendo l’ordine fornito dal retriever.【F:datapizza-ai-core/datapizza/core/vectorstore/vectorstore.py†L25-L112】 |

### Componenti per nodi `input`

- **`datapizza.modules.parsers.text_parser.TextParser`**: suddivide un testo in documenti/paragrafi/frasi senza parametri obbligatori.【F:datapizza-ai-core/datapizza/modules/parsers/text_parser.py†L7-L93】 
- **`datapizza.modules.parsers.docling.DoclingParser`**: accetta PDF e opzionalmente `json_output_dir` per salvare l’estrazione intermedia.【F:datapizza-ai-modules/parsers/docling/datapizza/modules/parsers/docling/docling_parser.py†L17-L90】 
- **`datapizza.modules.parsers.azure.AzureParser`**: richiede `api_key`, `endpoint` e permette `result_type` personalizzato per i payload di Azure Document Intelligence.【F:datapizza-ai-modules/parsers/azure/datapizza/modules/parsers/azure/azure_parser.py†L17-L156】 
- **`datapizza.modules.treebuilder.LLMTreeBuilder`**: costruisce alberi semantici da testo grezzo usando un client LLM e supporta un `system_prompt` opzionale.【F:datapizza-ai-core/datapizza/modules/treebuilder/llm_treebuilder.py†L35-L147】 

### Componenti per nodi `task`

- **Splitter**: `TextSplitter`, `RecursiveSplitter`, `NodeSplitter`, `PDFImageSplitter` permettono di generare `Chunk` a partire da testo o alberi con parametri come `max_char`, `overlap`, `image_format` e `dpi` per i PDF.【F:datapizza-ai-core/datapizza/modules/splitters/text_splitter.py†L7-L63】【F:datapizza-ai-core/datapizza/modules/splitters/recursive_splitter.py†L7-L99】【F:datapizza-ai-core/datapizza/modules/splitters/node_splitter.py†L5-L54】【F:datapizza-ai-core/datapizza/modules/splitters/pdf_image_splitter.py†L12-L122】 
- **Captioner**: `LLMCaptioner` aggiunge descrizioni a nodi multimediali e accetta un client LLM più parametri di tuning (`max_workers`, prompt dedicati).【F:datapizza-ai-core/datapizza/modules/captioners/llm_captioner.py†L9-L200】 
- **Metatagger**: `KeywordMetatagger` arricchisce i chunk con parole chiave sfruttando un client LLM e parametri opzionali per prompt e nome del campo di output.【F:datapizza-ai-core/datapizza/modules/metatagger/keyword_metatagger.py†L11-L86】 
- **Reranker**: `CohereReranker` e `TogetherReranker` richiedono le rispettive credenziali/API e parametri `top_n`/`threshold` per filtrare i risultati.【F:datapizza-ai-modules/rerankers/cohere/datapizza/modules/rerankers/cohere/cohere_reranker.py†L5-L138】【F:datapizza-ai-modules/rerankers/together/datapizza/modules/rerankers/together/together_reranker.py†L5-L74】 
- **Prompt builder**: `ChatPromptTemplate` e `ImageRAGPrompt` generano `Memory` combinando prompt Jinja2, chunk recuperati e, nel caso image-RAG, estrazioni multimediali da PDF.【F:datapizza-ai-core/datapizza/modules/prompt/prompt.py†L18-L109】【F:datapizza-ai-core/datapizza/modules/prompt/image_rag.py†L9-L111】 
- **Rewriter**: `ToolRewriter` usa un client LLM con strumenti opzionali per trasformare query testuali, restituendo stringhe pronte per step successivi.【F:datapizza-ai-core/datapizza/modules/rewriters/tool_rewriter.py†L9-L105】 

### Componenti per nodi `output`

- **`datapizza.pipeline.IngestionPipeline`**: orchestration di moduli di parsing/elaborazione con possibilità di push automatico verso un vector store; restituisce i `Chunk` finali se nessun backend è collegato.【F:datapizza-ai-core/datapizza/pipeline/pipeline.py†L34-L134】 
- **`datapizza.vectorstores.qdrant.QdrantVectorstore`** (ed estensioni analoghe): implementa metodi `add/a_add`, `search/a_search`, `retrieve` e `remove` per gestire collezioni di chunk, producendo o consumando liste di `Chunk`.【F:datapizza-ai-vectorstores/datapizza-ai-vectorstores-qdrant/datapizza/vectorstores/qdrant/qdrant_vectorstore.py†L19-L200】 
- **`Vectorstore.as_retriever`**: consente di trasformare un vector store in componente da utilizzare come nodo `task`/`output` che restituisce chunk ordinati secondo la ricerca semantica.【F:datapizza-ai-core/datapizza/core/vectorstore/vectorstore.py†L25-L112】 

### Serializzazione dei risultati verso il frontend

Per mantenere omogeneo il contratto con il frontend:

1. Popolare `WorkflowExecutionResult.steps` con l’avanzamento del job e usare `outputs` per i dati prodotti da ogni nodo.【F:visual-editor/src/workflow-format.ts†L136-L148】 
2. Serializzare i `Chunk` come dizionari semplici (id, text, metadata, embeddings) e i `Node` come alberi JSON annidati; per `Memory` utilizzare `memory.to_dict()` o `memory.json_dumps()` a seconda delle esigenze dell’interfaccia.【F:datapizza-ai-core/datapizza/type/type.py†L467-L492】【F:datapizza-ai-core/datapizza/memory/memory.py†L45-L200】 
3. Restituire eventuali ID di collezione, conteggi o riferimenti ad artefatti (`s3://…`) in chiavi dedicate (`collection`, `stored`, `artifacts`) all’interno di `outputs` così da consentire al frontend di mapparli su pannelli di dettaglio.【F:visual-editor/backend/app/models.py†L244-L258】 

