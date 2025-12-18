"use client";

import { useState } from "react";
import { ChevronDown, ChevronRight, CheckCircle, Circle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

interface SectionAccordionProps {
  title: string;
  sectionKey: string;
  fieldCount: number;
  filledCount: number;
  children: React.ReactNode;
  isExpanded?: boolean;
  onToggle?: () => void;
}

export function SectionAccordion({
  title,
  sectionKey,
  fieldCount,
  filledCount,
  children,
  isExpanded: controlledExpanded,
  onToggle
}: SectionAccordionProps) {
  const [internalExpanded, setInternalExpanded] = useState(false);

  const isExpanded = controlledExpanded !== undefined ? controlledExpanded : internalExpanded;
  const progress = fieldCount > 0 ? Math.round((filledCount / fieldCount) * 100) : 0;
  const isComplete = progress === 100 && fieldCount > 0;
  const hasStarted = progress > 0;

  const handleToggle = () => {
    if (onToggle) {
      onToggle();
    } else {
      setInternalExpanded(!internalExpanded);
    }
  };

  return (
    <Card className="w-full">
      <CardHeader
        className="pb-3 cursor-pointer hover:bg-gray-50 transition-colors"
        onClick={handleToggle}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center w-8 h-8">
              {isComplete ? (
                <CheckCircle className="w-5 h-5 text-green-600" />
              ) : hasStarted ? (
                <Circle className="w-5 h-5 text-blue-600 fill-current" />
              ) : (
                <Circle className="w-5 h-5 text-gray-400" />
              )}
            </div>

            <div>
              <CardTitle className="text-lg">
                Section {sectionKey}: {title}
              </CardTitle>
              <div className="flex items-center gap-2 mt-1">
                <Badge
                  variant={isComplete ? "default" : hasStarted ? "secondary" : "outline"}
                  className="text-xs"
                >
                  {filledCount}/{fieldCount} fields
                </Badge>
                <span className="text-xs text-gray-500">
                  ({progress}% complete)
                </span>
              </div>
            </div>
          </div>

          <Button variant="ghost" size="sm" className="w-8 h-8 p-0">
            {isExpanded ? (
              <ChevronDown className="w-4 h-4" />
            ) : (
              <ChevronRight className="w-4 h-4" />
            )}
          </Button>
        </div>

        {/* Progress bar */}
        <div className="mt-3 w-full bg-gray-200 rounded-full h-2">
          <div
            className={cn(
              "h-2 rounded-full transition-all duration-300",
              isComplete
                ? "bg-green-500"
                : hasStarted
                  ? "bg-blue-500"
                  : "bg-gray-300"
            )}
            style={{ width: `${progress}%` }}
          />
        </div>
      </CardHeader>

      {isExpanded && (
        <CardContent className="pt-0">
          <div className="space-y-4">
            {children}
          </div>
        </CardContent>
      )}
    </Card>
  );
}