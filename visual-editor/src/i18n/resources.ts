export const translations = {
  it: {
    locales: {
      it: "Italiano",
      en: "Inglese",
    },
    header: {
      title: "Workflow Visual Editor",
      description:
        "Crea, orchestra e testa pipeline di machine learning con un canvas interattivo e pannelli contestuali pensati per team data-driven.",
      importedBadge: "Import manuale",
      importedPrefix: "Workflow importato:",
      activePrefix: "Template attivo:",
      currentWorkflowPrefix: "Workflow corrente:",
      libraryButton: "Catalogo workflow",
      importButton: "Importa workflow",
      exportButton: "Esporta workflow",
      themeToggle: {
        light: "Modalità scura",
        dark: "Modalità chiara",
      },
      languageLabel: "Lingua",
      templateCategoryFallback: "Categoria personalizzata",
    },
    exportMenu: {
      ariaLabel: "Formati di esportazione del workflow",
      downloadJson: "Scarica JSON",
      downloadYaml: "Scarica YAML",
    },
    workflow: {
      canvasAria: "Canvas del workflow",
      sidebarAria: "Pannello laterale del workflow",
    },
    template: {
      title: "Dettagli template",
      description: "Riferimenti rapidi al template attivo e alle sue note principali.",
      importedMessage: (version: string) =>
        `Definizione caricata da file. Il workflow è stato migrato automaticamente alla versione ${version}.`,
      authorLabel: "Autore",
      tagsLabel: "Tag",
      createdAtLabel: "Creato il",
    },
    validation: {
      title: "Validazione workflow",
      description:
        "Monitora i problemi del grafo in tempo reale e avvia la validazione remota con il backend FastAPI.",
      realtimeTitle: "Analisi in tempo reale",
      remoteTitle: "Validazione remota",
      errorsLabel: "Errori",
      warningsLabel: "Avvisi",
      emptyState:
        "Nessun problema rilevato sul grafo corrente. Collega i nodi o modifica i parametri per mantenere il workflow consistente.",
      issueScope: {
        workflow: "Workflow",
        edge: "Arco",
        node: "Nodo",
        unknown: "sconosciuto",
      },
      validateButton: "Valida definizione",
      validatingButton: "Validazione in corso...",
      idleMessage:
        "Avvia la validazione per ottenere un riepilogo degli eventuali problemi strutturali e semantici del workflow.",
      loadingMessage: "Analisi della definizione in corso...",
      successMessage: "La definizione è stata validata correttamente.",
      errorMessage: "La definizione contiene alcune incongruenze.",
      sourceRemote: " (risposta backend)",
      sourceLocal: " (validator locale)",
    },
    runner: {
      title: "Esegui workflow",
      description:
        "Invia il grafo corrente al backend FastAPI per verificarne la serializzazione e le opzioni runtime.",
      environmentLabel: "Ambiente runtime",
      environmentPlaceholder: "es. staging",
      datasetLabel: "Dataset sorgente (URI)",
      datasetPlaceholder: "es. s3://bucket/path",
      runButton: "Esegui workflow",
      runningButton: "Esecuzione in corso...",
      statusLabel: "Stato",
      runIdLabel: "Run ID",
    },
    history: {
      title: "Cronologia esecuzioni",
      description: "Consulta le esecuzioni precedenti, ripetile e scarica gli artefatti generati.",
      loading: "Caricamento cronologia…",
      logsLoading: "Caricamento log…",
      emptyLogs: "Nessun log disponibile per questa esecuzione.",
      selectRun: "Seleziona una run per visualizzare i log in streaming.",
    },
    nodeDetails: {
      title: "Dettagli nodo",
      description: "Seleziona un nodo dal canvas per modificarne label, tipo e parametri JSON.",
      loading: "Caricamento dettagli nodo…",
      empty: "Nessun nodo selezionato. Clicca su un nodo nel canvas per visualizzare i dettagli.",
    },
    nodeStatus: {
      title: "Stato dei nodi",
    },
    outputs: {
      title: "Output esecuzione",
      empty: "Nessun output disponibile. Avvia un'esecuzione per visualizzare i risultati.",
    },
    library: {
      ariaLabel: "Catalogo template e nodi preconfigurati",
      eyebrow: "Libreria",
      title: "Workflow e nodi preconfigurati",
      close: "Chiudi",
      closeLabel: "Chiudi catalogo",
      workflowsTitle: "Workflow predefiniti",
      workflowsDescription: "Applica un template per reimpostare rapidamente nodi ed archi.",
      reload: "Ricarica",
      apply: "Applica",
      nodesTitle: "Nodi preconfigurati",
      nodesDescription: "Trascina i nodi nel canvas per arricchire il workflow corrente.",
      searchLabel: "Filtra catalogo",
      searchPlaceholder: "Cerca per nome, descrizione o tag",
      filtersTitle: "Tag disponibili",
      filtersAriaLabel: "Filtri del catalogo",
      clearFilters: "Azzera filtri",
      tagsEmpty: "Nessun tag disponibile",
      resultsSummary: (count: number) =>
        count === 1 ? "1 risultato disponibile" : `${count} risultati disponibili`,
      workflowsResultLabel: "Workflow trovati",
      nodesResultLabel: "Nodi trovati",
      emptyStateTitle: "Nessun elemento corrisponde ai filtri",
      emptyStateDescription:
        "Modifica la ricerca o seleziona tag differenti per visualizzare template e nodi.",
      workflowsEmpty: "Nessun workflow corrisponde ai filtri correnti.",
      nodesEmpty: "Nessun nodo corrisponde ai filtri correnti.",
    },
    importDialog: {
      eyebrow: "Importazione",
      title: "Carica un workflow esistente",
      description:
        "Seleziona un file .json, .yaml o .yml. Il contenuto verrà migrato alla versione supportata e caricato nel canvas.",
      fieldLabel: "Definizione workflow",
      loading: "Analisi del file in corso...",
      hint: "Suggerimento: esporta dal backend Datapizza o riutilizza un file creato con questo editor per mantenere compatibili i componenti.",
      close: "Chiudi",
    },
    messages: {
      executionCancelled: "Esecuzione annullata dall'utente",
      executionUnexpectedError: "Errore imprevisto durante l'esecuzione del workflow",
      importParseError:
        "Impossibile analizzare il file. Assicurati che sia un JSON o YAML valido.",
      importInvalidDefinition: "Il file non contiene una definizione di workflow valida.",
      importWorkflowError: "Impossibile importare il workflow",
      importWorkflowUnknown: "Impossibile importare il workflow: formato non riconosciuto",
      retryError: "Errore durante il retry dell'esecuzione",
      archiveError: "Errore durante l'archiviazione dell'esecuzione",
      logFetchError: "Errore durante il recupero dei log del workflow",
    },
    status: {
      idle: "In attesa",
      pending: "In coda",
      running: "In esecuzione",
      completed: "Completato",
      failed: "Fallito",
    },
    aria: {
      themeToggle: "Cambia tema",
      exportMenuButton: "Apri menu di esportazione",
      workflowNameLive: "Aggiornamento informazioni workflow",
    },
    shortcuts: {
      heading: "Scorciatoie da tastiera",
      toggleLibrary: "Apri o chiudi il catalogo (Ctrl+Shift+L)",
      openImport: "Apri la finestra di import (Ctrl+Shift+I)",
      toggleExport: "Apri il menu di esportazione (Ctrl+Shift+E)",
      runWorkflow: "Esegui workflow (Ctrl+Invio)",
    },
  },
  en: {
    locales: {
      it: "Italian",
      en: "English",
    },
    header: {
      title: "Workflow Visual Editor",
      description:
        "Design, orchestrate, and test machine-learning pipelines with an interactive canvas and contextual panels built for data teams.",
      importedBadge: "Manual import",
      importedPrefix: "Imported workflow:",
      activePrefix: "Active template:",
      currentWorkflowPrefix: "Current workflow:",
      libraryButton: "Workflow catalog",
      importButton: "Import workflow",
      exportButton: "Export workflow",
      themeToggle: {
        light: "Switch to dark mode",
        dark: "Switch to light mode",
      },
      languageLabel: "Language",
      templateCategoryFallback: "Custom category",
    },
    exportMenu: {
      ariaLabel: "Workflow export formats",
      downloadJson: "Download JSON",
      downloadYaml: "Download YAML",
    },
    workflow: {
      canvasAria: "Workflow canvas",
      sidebarAria: "Workflow side panel",
    },
    template: {
      title: "Template details",
      description: "Quick references for the active template and its main notes.",
      importedMessage: (version: string) =>
        `Definition loaded from file. The workflow was migrated automatically to version ${version}.`,
      authorLabel: "Author",
      tagsLabel: "Tags",
      createdAtLabel: "Created on",
    },
    validation: {
      title: "Workflow validation",
      description:
        "Monitor graph issues in real time and trigger remote validation with the FastAPI backend.",
      realtimeTitle: "Real-time analysis",
      remoteTitle: "Remote validation",
      errorsLabel: "Errors",
      warningsLabel: "Warnings",
      emptyState:
        "No issues detected on the current graph. Connect nodes or adjust parameters to keep the workflow consistent.",
      issueScope: {
        workflow: "Workflow",
        edge: "Edge",
        node: "Node",
        unknown: "unknown",
      },
      validateButton: "Validate definition",
      validatingButton: "Validation in progress...",
      idleMessage:
        "Run validation to get a summary of structural and semantic issues in the workflow.",
      loadingMessage: "Analyzing definition...",
      successMessage: "The definition was validated successfully.",
      errorMessage: "The definition contains some inconsistencies.",
      sourceRemote: " (backend response)",
      sourceLocal: " (local validator)",
    },
    runner: {
      title: "Run workflow",
      description:
        "Send the current graph to the FastAPI backend to verify serialization and runtime options.",
      environmentLabel: "Runtime environment",
      environmentPlaceholder: "e.g. staging",
      datasetLabel: "Source dataset (URI)",
      datasetPlaceholder: "e.g. s3://bucket/path",
      runButton: "Run workflow",
      runningButton: "Workflow running...",
      statusLabel: "Status",
      runIdLabel: "Run ID",
    },
    history: {
      title: "Run history",
      description: "Review past executions, retry them, and download generated artifacts.",
      loading: "Loading history…",
      logsLoading: "Loading logs…",
      emptyLogs: "No logs available for this run.",
      selectRun: "Select a run to stream logs.",
    },
    nodeDetails: {
      title: "Node details",
      description: "Select a node from the canvas to edit its label, type, and JSON parameters.",
      loading: "Loading node details…",
      empty: "No node selected. Click a node in the canvas to see its details.",
    },
    nodeStatus: {
      title: "Node status",
    },
    outputs: {
      title: "Run output",
      empty: "No outputs yet. Start a run to review the results.",
    },
    library: {
      ariaLabel: "Template and preconfigured node catalog",
      eyebrow: "Library",
      title: "Preconfigured workflows and nodes",
      close: "Close",
      closeLabel: "Close catalog",
      workflowsTitle: "Preset workflows",
      workflowsDescription: "Apply a template to quickly reset nodes and edges.",
      reload: "Reload",
      apply: "Apply",
      nodesTitle: "Preconfigured nodes",
      nodesDescription: "Drag nodes onto the canvas to enrich the current workflow.",
      searchLabel: "Filter catalog",
      searchPlaceholder: "Search by name, description, or tag",
      filtersTitle: "Available tags",
      filtersAriaLabel: "Catalog filters",
      clearFilters: "Clear filters",
      tagsEmpty: "No tags available",
      resultsSummary: (count: number) =>
        count === 1 ? "1 result available" : `${count} results available`,
      workflowsResultLabel: "Workflows found",
      nodesResultLabel: "Nodes found",
      emptyStateTitle: "No items match the selected filters",
      emptyStateDescription:
        "Adjust the search or pick different tags to explore available templates and nodes.",
      workflowsEmpty: "No workflows match the current filters.",
      nodesEmpty: "No nodes match the current filters.",
    },
    importDialog: {
      eyebrow: "Import",
      title: "Upload an existing workflow",
      description:
        "Select a .json, .yaml, or .yml file. The content will be migrated to the supported version and loaded into the canvas.",
      fieldLabel: "Workflow definition",
      loading: "Analyzing file...",
      hint: "Tip: export from the Datapizza backend or reuse a file generated with this editor to keep components compatible.",
      close: "Close",
    },
    messages: {
      executionCancelled: "Workflow run cancelled by the user",
      executionUnexpectedError: "Unexpected error while running the workflow",
      importParseError: "Unable to parse the file. Make sure it is valid JSON or YAML.",
      importInvalidDefinition: "The file does not contain a valid workflow definition.",
      importWorkflowError: "Unable to import the workflow",
      importWorkflowUnknown: "Unable to import the workflow: unsupported format",
      retryError: "Error while retrying the execution",
      archiveError: "Error while archiving the execution",
      logFetchError: "Error while fetching workflow logs",
    },
    status: {
      idle: "Idle",
      pending: "Queued",
      running: "Running",
      completed: "Completed",
      failed: "Failed",
    },
    aria: {
      themeToggle: "Toggle theme",
      exportMenuButton: "Open export menu",
      workflowNameLive: "Workflow information update",
    },
    shortcuts: {
      heading: "Keyboard shortcuts",
      toggleLibrary: "Open or close the catalog (Ctrl+Shift+L)",
      openImport: "Open the import dialog (Ctrl+Shift+I)",
      toggleExport: "Open the export menu (Ctrl+Shift+E)",
      runWorkflow: "Run workflow (Ctrl+Enter)",
    },
  },
} as const;

export type Translations = typeof translations;
export type Locale = keyof Translations;
export const defaultLocale: Locale = "it";
export const availableLocales = Object.keys(translations) as Locale[];

export function getTranslations(locale: Locale) {
  return translations[locale] ?? translations[defaultLocale];
}
