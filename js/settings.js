// The manager's settings. Change them here; nothing else in the code names an organization, group or address.
export const SETTINGS = {
  portal: "https://www.arcgis.com",
  // ArcGIS sign-in for the education team's pages. Its app registration must list this page's address
  // (https://jsawle.github.io/AtlasLab-manager/) as a redirect URI.
  clientId: "MUSDSIajsXZwJeZQ",
  // The ArcGIS Online group of the education team members who may use the manager. Make it a shared-update group in
  // the organization that owns the partners' config items, and share every item with it, so any member can publish.
  // Empty: any signed-in member of an organization in partnerOrgs gets in (a notice says so).
  teamGroup: "",
  // The organization the partners' config items are kept in: GIS 4 Schools (gis-4-schools.maps.arcgis.com), not the
  // MapMaker organization. AtlasLab accepts items from these only (PARTNER_ORGS in its src/config.js; keep the two the same).
  partnerOrgs: ["HNLEA4GfnbCFQZGa"],
  orgNames: { HNLEA4GfnbCFQZGa: "GIS 4 Schools" },
  // The published AtlasLab. Partner apps open at <atlasUrl>?appid=<item ID>; the preview frames <atlasUrl>?preview=1.
  atlasUrl: "https://jsawle.github.io/AtlasLab/",
  // AtlasLab's own sign-in client ID: a partner config that allows signing in uses this one, which is registered for atlasUrl.
  atlasClientId: "MUSDSIajsXZwJeZQ",
  partnerKeyword: "AtlasLabPartnerConfig",
  registerKeyword: "AtlasLabPartnerRegister",
  maxLogoBytes: 100 * 1024
};
