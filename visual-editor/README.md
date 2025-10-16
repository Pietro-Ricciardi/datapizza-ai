# Datapizza Visual Editor

## Obiettivi
- Offrire un'interfaccia visuale stile n8n per orchestrare agenti, tool e pipeline Datapizza.
- Permettere la configurazione low-code di scenari RAG e workflow multi-agente.
- Fornire uno standard per i "nodi" che mappi le componenti Python esistenti del framework.

## Architettura proposta
1. **Frontend SPA (React + TypeScript)**
   - Basata su [Vite](https://vitejs.dev/) per rapidità di sviluppo.
   - Libreria per graph editing: [React Flow](https://reactflow.dev/) per drag&drop di nodi e connessioni.
   - Stato globale con Zustand per mantenere il grafo e configurazioni dei nodi.
   - Componenti principali:
     - `EditorCanvas`: viewport del grafo con supporto zoom, snap e mini-mappa.
     - `NodeSidebar`: elenco nodi disponibili filtrabile per categoria (modelli, tool, memoria, integrazioni, I/O).
     - `InspectorPanel`: editing delle proprietà del nodo selezionato con form dinamiche.
     - `ExecutionPanel`: log runtime, stato esecuzione, preview output.

2. **Backend leggero (FastAPI)**
   - Esposto sotto `visual-editor/api` come microservizio opzionale.
   - Responsabilità:
     - Serializzazione/deserializzazione dei workflow in formato JSON/YAML.
     - Validazione rispetto allo schema dei nodi.
     - Trigger di esecuzione sfruttando il core Datapizza (caricando dinamicamente agenti/tool).
     - Endpoint per inventory (elenco nodi disponibili) e per upload/download di template.
   - Integrazione con OpenTelemetry per mantenere la visibilità già presente nel framework.

3. **Bridge con Datapizza**
   - Modulo Python `datapizza.visual_editor.bridge` con helper per:
     - Caricare tool registrati via entry-point/plug-in (riprende pattern dei pacchetti opzionali).
     - Conversione workflow visuale → orchestrazione `Agent`/`Pipeline`.
     - Esecuzione step-by-step con callback per il frontend.

## Standard dei nodi
Ogni nodo segue uno schema JSON compatibile con [JSON Schema](https://json-schema.org/):

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "title": "VisualEditorNode",
  "type": "object",
  "required": ["id", "type", "version", "config"],
  "properties": {
    "id": {"type": "string"},
    "type": {"type": "string", "description": "Categoria del nodo (agent, tool, retriever, control)"},
    "version": {"type": "string", "pattern": "^\\d+\\.\\d+\\.\\d+$"},
    "label": {"type": "string"},
    "description": {"type": "string"},
    "inputs": {
      "type": "array",
      "items": {"type": "string"},
      "description": "Socket in ingresso identificati da nome"},
    "outputs": {
      "type": "array",
      "items": {"type": "string"},
      "description": "Socket in uscita"},
    "config": {"type": "object"},
    "ui": {
      "type": "object",
      "properties": {
        "icon": {"type": "string"},
        "color": {"type": "string"},
        "sections": {"type": "array"}
      }
    }
  }
}
```

### Convenzioni per categorie
- `agent`: incapsula istanze di `datapizza.agents.Agent` o pipeline complesse.
- `tool`: rappresenta funzioni decorate con `@tool` o tool esterni (SQL, web search, ecc.).
- `retriever`: integra moduli RAG (vector store, embedders).
- `control`: gestisce branching, loop, trasformazioni (es. `If`, `Map`, `Parallel`).
- `io`: ingressi/uscite workflow (es. HTTP Trigger, Webhook Response, Scheduler).

Ogni nodo dichiara un file `node.json` (vedi esempio sotto) e opzionalmente un form React per l'editor.

```json
{
  "id": "openai.chat_completion",
  "type": "agent",
  "version": "0.1.0",
  "label": "OpenAI Chat",
  "description": "Invoca un modello chat di OpenAI tramite client Datapizza",
  "inputs": ["prompt", "context"],
  "outputs": ["response", "metadata"],
  "config": {
    "model": {"type": "string", "default": "gpt-4o-mini"},
    "temperature": {"type": "number", "default": 0.7, "minimum": 0, "maximum": 2},
    "tools": {"type": "array", "items": {"type": "string"}}
  },
  "ui": {
    "icon": "openai",
    "color": "#0D9488",
    "sections": [
      {"title": "Modello", "fields": ["model", "temperature"]},
      {"title": "Tool", "fields": ["tools"]}
    ]
  }
}
```

## Serializzazione Workflow
- Il grafo viene esportato in JSON con nodi, collegamenti e metadati di layout.
- Esempio di payload:

```json
{
  "name": "Lead Qualification",
  "version": "0.1.0",
  "nodes": [ ... ],
  "edges": [
    {"from": {"node": "http.trigger", "output": "body"}, "to": {"node": "openai.chat_completion", "input": "prompt"}}
  ],
  "run": {
    "entrypoint": "http.trigger",
    "output": "webhook.response"
  }
}
```

## Roadmap
1. **MVP**
   - Setup Vite + React + React Flow.
   - Implementazione nodi base (HTTP Trigger, Agent OpenAI, Tool Python, Webhook Response).
   - Persistenza locale (browser `localStorage`) + export/import JSON.
   - Backend FastAPI con endpoint `/inventory` e `/run` stub.

2. **Integrazione Datapizza**
   - Caricamento automatico dei tool registrati dal core (via entry points o plugin discovery).
   - Esecuzione step-by-step con aggiornamento WebSocket per il frontend.

3. **Estensioni**
   - Versioning workflow + template library.
   - Deploy su server + autenticazione.
   - Marketplace nodi (pubblicazione di pacchetti `datapizza-ai-visual-node-*`).

## Sviluppo locale
1. Eseguire `make visual-editor-dev` dalla root del repository per installare le dipendenze (`npm install`) e avviare Vite in modalità dev (`npm run dev`).
2. È possibile usare direttamente `npm run dev` all'interno di `visual-editor/` per avviare il server dopo la prima installazione.
3. Il target di make non modifica componenti esterni alla cartella, preservando l'autonomia del progetto.

## Decisioni operative
- ✅ Il visual editor rimane **standalone**: vedi [decision log](../docs/visual-editor/standalone.md).
- 🚫 Non creare workspace monorepo JS condivisi con il resto del repository.

## Prossimi passi
- Preparare guide di contribuzione specifiche e template per l'aggiunta di nodi (in attesa).

## Cosa implementare subito
Per iniziare a sviluppare l'editor in piccoli passi mantenendo un feedback rapido, concentrarsi su:

1. **Setup tecnico minimo**
   - Inizializzare il progetto Vite + React + TypeScript.
   - Integrare React Flow con un canvas vuoto e supporto allo zoom/pan.

2. **Nodi fondamentali dell'MVP**
   - Implementare i nodi base (HTTP Trigger, Agent OpenAI, Tool Python, Webhook Response) con i relativi `node.json`.
   - Aggiungere un inspector minimale per modificare le proprietà principali (prompt, endpoint, ecc.).

3. **Gestione stato e persistenza**
   - Configurare Zustand per mantenere nodi/edge in memoria.
   - Abilitare salvataggio/caricamento da `localStorage` ed export/import manuale JSON.

4. **Backend stub**
   - Creare il microservizio FastAPI con endpoint `/inventory` (ritorna nodi base) e `/run` (ritorna risposta mock).
   - Documentare come avviare il backend insieme al frontend per i test.

5. **Osservabilità e test**
   - Abilitare logging strutturato lato frontend e backend.
   - Preparare test end-to-end basilari (es. Playwright) per garantire che il drag&drop e l'export funzionino.

