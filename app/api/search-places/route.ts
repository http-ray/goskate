import { NextRequest, NextResponse } from "next/server";

// ============================================================
// Google Places Text Search API Route
//
// Used by Add Spot flow to search for addresses and places.
// Returns place results with coordinates for location selection.
// ============================================================

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const query = searchParams.get("query");

  if (!query) {
    return NextResponse.json({ error: "Missing query parameter" }, { status: 400 });
  }

  const apiKey = process.env.GOOGLE_MAPS_API_KEY;

  if (!apiKey) {
    console.error("GOOGLE_MAPS_API_KEY not configured");
    return NextResponse.json(
      { error: "API key not configured" },
      { status: 500 }
    );
  }

  try {
    const url = new URL("https://maps.googleapis.com/maps/api/place/textsearch/json");
    url.searchParams.set("query", query);
    url.searchParams.set("key", apiKey);

    const response = await fetch(url.toString());
    const data = await response.json();

    if (data.status !== "OK" && data.status !== "ZERO_RESULTS") {
      console.error("Google Places API error:", data.status, data.error_message);
      return NextResponse.json(
        { error: "Search failed", details: data.error_message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      results: data.results || [],
      status: data.status,
    });
  } catch (error) {
    console.error("Place search error:", error);
    return NextResponse.json(
      { error: "Search request failed" },
      { status: 500 }
    );
  }
}
