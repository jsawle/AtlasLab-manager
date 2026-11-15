// Version numbers: the app's, and each part's. Bump a part when what it does changes, the app on every release.
import { DRAFT_VERSION, DIFF_VERSION } from "./config-tools.js?v=1.0.0";
import { CHECKS_VERSION } from "./checks.js?v=1.0.0";
import { ATLAS_SYNCED } from "./atlas-defaults.js?v=1.0.0";

export const APP_VERSION = "1.0.0";
export const FORM_VERSION = "1.0";
export const PREVIEW_VERSION = "1.0";
export const PUBLISH_VERSION = "1.0";
export const USAGE_VERSION = "1.0";
export const REGISTER_VERSION = "1.0";

export const VERSION_ROWS = [
  ["AtlasLab manager (app)", APP_VERSION, "Set up, change and publish partners' versions of AtlasLab, and see how much each is used. Created by Jason Sawle."],
  ["Config form", FORM_VERSION, "The settings a partner can change, grouped as AtlasLab's configs are, written as the smallest config that does it."],
  ["Checks", CHECKS_VERSION, "What is checked before a draft is saved or a config published: IDs, colour contrast (WCAG 2.1 AA), links, logo size and type, the sign-in message's HTML, wording keys; and, online, that the groups and basemap exist and are public."],
  ["Preview", PREVIEW_VERSION, "The real AtlasLab in a frame, given the config by message (AtlasLab 5.0.0-beta.58 or later)."],
  ["Draft files", DRAFT_VERSION, "What a distributor saves from the form and puts in their Teams channel: the config, the partner's name, notes, and which live item it changes."],
  ["Comparing configs", DIFF_VERSION, "Every setting that a draft adds, removes or changes, against what is live."],
  ["Publishing", PUBLISH_VERSION, "Writes the config into the partner's ArcGIS Online item; Make live shares the item with everyone, Take offline stops sharing it."],
  ["Usage", USAGE_VERSION, "From ArcGIS Online's own counts only: opens of each partner's app (views of its config item, daily for the past year for the item's owner or an administrator) and views of the maps in its content group. Nothing is added to AtlasLab to count."],
  ["Partner register", REGISTER_VERSION, "Private notes on each partner, and who published what and when, in one private item of the team's."],
  ["AtlasLab defaults", ATLAS_SYNCED, "The app's built-in settings, wording and languages, copied from this AtlasLab version (tools/sync-atlaslab.mjs)."]
];
