import { NextRequest, NextResponse } from "next/server";
import { loadFieldGroups, type FieldGroup } from "@/lib/field-groups-loader";

export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    const searchParams = request.nextUrl.searchParams;
    const section = searchParams.get("section");

    const fieldGroups = await loadFieldGroups();

    if (section) {
      // Filter field groups by section if requested
      const filteredGroups: Record<string, FieldGroup> = {};
      Object.entries(fieldGroups).forEach(([fieldName, fieldGroup]) => {
        if (fieldGroup.fieldType === "RadioGroup" && fieldGroup.displayLabel) {
          // For debugging, include all radio groups so users can see the enhanced labels
          filteredGroups[fieldName] = fieldGroup;
        }
      });

      return NextResponse.json({
        section,
        fieldGroups: filteredGroups,
        count: Object.keys(filteredGroups).length,
      });
    }

    return NextResponse.json({
      fieldGroups,
      count: Object.keys(fieldGroups).length,
    });
  } catch (error) {
    console.error("Error loading field groups:", error);
    return NextResponse.json(
      { error: "Failed to load field groups" },
      { status: 500 }
    );
  }
}