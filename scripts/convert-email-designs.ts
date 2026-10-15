/**
 * One-off: convert every stored email design to the new designer's document model
 * (designJson v2) and re-render its HTML from that model, so the old builder's output
 * is gone from the database. Templates, the sent blast, and designed drip steps.
 */
import { Client } from "pg";
import { config } from "dotenv";
import { importHtml } from "@/lib/email-designer/import-html";
import { renderDesign } from "@/lib/email-designer/render";
import { isDesign, DEFAULT_BRAND, type BrandLibrary } from "@/lib/email-designer/model";

config();

(async () => {
  const c = new Client({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
  await c.connect();
  const brandRow = await c.query(`select value from "AppSetting" where key = 'brand.library'`);
  const brand: BrandLibrary = brandRow.rows[0] ? { ...DEFAULT_BRAND, ...JSON.parse(brandRow.rows[0].value) } : DEFAULT_BRAND;
  const dry = process.argv.includes("--dry");

  const convert = (html: string, existing: unknown) => {
    if (isDesign(existing)) return null; // already on the new model
    const design = importHtml(html, brand);
    return { design, html: renderDesign(design) };
  };

  for (const table of ["EmailTemplate", "EmailCampaign"]) {
    const rows = await c.query(`select id, name, html, "designJson" from "${table}"`);
    for (const r of rows.rows) {
      const out = convert(r.html || "", r.designJson);
      if (!out) { console.log(`${table} ${r.name}: already v2`); continue; }
      const blocks = out.design.sections.reduce((n, s) => n + s.columns.reduce((m, col) => m + col.blocks.length, 0), 0);
      console.log(`${table} ${r.name}: ${out.design.sections.length} sections, ${blocks} blocks, html ${r.html.length} → ${out.html.length}`);
      if (!dry) await c.query(`update "${table}" set "designJson" = $2::jsonb, html = $3, "updatedAt" = now() where id = $1`, [r.id, JSON.stringify(out.design), out.html]);
    }
  }
  const steps = await c.query(`select s.id, s.html, s."designJson", c.name from "CampaignStep" s join "Campaign" c on c.id = s."campaignId" where s.html is not null`);
  for (const r of steps.rows) {
    const out = convert(r.html, r.designJson);
    if (!out) { console.log(`Step in ${r.name}: already v2`); continue; }
    console.log(`Step in ${r.name}: ${out.design.sections.length} sections`);
    if (!dry) await c.query(`update "CampaignStep" set "designJson" = $2::jsonb, html = $3 where id = $1`, [r.id, JSON.stringify(out.design), out.html]);
  }
  await c.end();
  console.log(dry ? "dry run" : "converted");
})();
