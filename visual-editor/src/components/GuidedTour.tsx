import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Joyride, {
  ACTIONS,
  EVENTS,
  STATUS,
  type CallBackProps,
  type Step,
} from "react-joyride";
import { useWorkflowStore, workflowSelectors } from "../store/workflow-store";
import type { Locale, Translations } from "../i18n/resources";

const CATALOG_STEP_INDEX = 3;

type GuidedTourCopy = Translations[Locale]["guidedTour"];

type GuidedTourProps = {
  translations: GuidedTourCopy;
  openCatalog: () => void;
  closeCatalog: () => void;
  isCatalogOpen: boolean;
};

const TOUR_TARGETS = {
  header: '[data-tour-id="guided-tour-header"]',
  canvas: '[data-tour-id="guided-tour-canvas"]',
  sidebar: '[data-tour-id="guided-tour-sidebar"]',
  catalog: '[data-tour-id="guided-tour-catalog"]',
} as const;

export function GuidedTour({ translations, openCatalog, closeCatalog, isCatalogOpen }: GuidedTourProps) {
  const guidedTour = useWorkflowStore(workflowSelectors.guidedTour);
  const completeGuidedTour = useWorkflowStore(workflowSelectors.completeGuidedTour);
  const [tourKey, setTourKey] = useState(0);
  const wasCatalogOpen = useRef(false);
  const previousRun = useRef(guidedTour.running);
  const manualStopRef = useRef(false);

  useEffect(() => {
    if (guidedTour.running && !previousRun.current) {
      setTourKey((value) => value + 1);
      wasCatalogOpen.current = isCatalogOpen;
      manualStopRef.current = false;
    }

    if (!guidedTour.running && previousRun.current) {
      manualStopRef.current = !guidedTour.completed;
      if (wasCatalogOpen.current) {
        openCatalog();
      } else {
        closeCatalog();
      }
    }

    previousRun.current = guidedTour.running;
  }, [guidedTour.completed, guidedTour.running, isCatalogOpen, openCatalog, closeCatalog]);

  const steps = useMemo<Step[]>(() => {
    return [
      {
        target: TOUR_TARGETS.header,
        title: translations.steps.header.title,
        content: translations.steps.header.content,
        disableBeacon: true,
        placement: "bottom-start",
      },
      {
        target: TOUR_TARGETS.canvas,
        title: translations.steps.canvas.title,
        content: translations.steps.canvas.content,
        placement: "right",
      },
      {
        target: TOUR_TARGETS.sidebar,
        title: translations.steps.sidebar.title,
        content: translations.steps.sidebar.content,
        placement: "left",
      },
      {
        target: TOUR_TARGETS.catalog,
        title: translations.steps.catalog.title,
        content: translations.steps.catalog.content,
        placement: "left",
      },
    ];
  }, [translations]);

  const handleCallback = useCallback(
    (event: CallBackProps) => {
      const { index, status, type, action } = event;

      if (type === EVENTS.STEP_BEFORE && index === CATALOG_STEP_INDEX) {
        openCatalog();
      }

      if (type === EVENTS.STEP_AFTER && index === CATALOG_STEP_INDEX && action !== ACTIONS.PREV) {
        if (!wasCatalogOpen.current) {
          closeCatalog();
        }
      }

      if (type === EVENTS.TARGET_NOT_FOUND && index === CATALOG_STEP_INDEX) {
        if (!wasCatalogOpen.current) {
          closeCatalog();
        }
      }

      if (type === EVENTS.TOUR_END || status === STATUS.FINISHED || status === STATUS.SKIPPED) {
        if (manualStopRef.current) {
          manualStopRef.current = false;
          return;
        }
        completeGuidedTour();
      }
    },
    [closeCatalog, completeGuidedTour, openCatalog],
  );

  return (
    <Joyride
      key={tourKey}
      steps={steps}
      run={guidedTour.running}
      continuous
      showSkipButton
      showProgress
      disableOverlayClose
      spotlightClicks={false}
      scrollToFirstStep
      locale={translations.locale}
      callback={handleCallback}
    />
  );
}

