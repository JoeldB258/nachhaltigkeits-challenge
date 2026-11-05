import { getStore } from "@netlify/blobs";
import { verarbeite } from "../../lib/logik.mjs";

export const config = { path: "/api" };

export default async (req) => {
  try {
    const store = getStore({ name: "challenge", consistency: "strong" });
    return await verarbeite(req, store);
  } catch (err) {
    console.error(err);
    return new Response(JSON.stringify({ ok: false, fehler: "server" }), {
      status: 500,
      headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" },
    });
  }
};
