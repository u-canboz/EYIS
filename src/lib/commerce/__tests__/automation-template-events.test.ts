import { describe, expect, it } from "vitest";
import { AUTOMATION_TEMPLATES } from "../automation/templates";
import { findEvent } from "../automation/event-registry";

describe("automation template event contracts", () => {
  for (const template of AUTOMATION_TEMPLATES.filter(
    (entry) => entry.triggerType === "domain_event",
  )) {
    it(`${template.key} uses a registered domain event`, () => {
      expect(findEvent(String(template.triggerConfig["eventType"]))).toBeDefined();
    });
  }
});
