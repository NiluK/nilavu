"use client";

import { useState, useMemo } from "react";
import { TrendingUp, Calendar, Filter, BarChart3 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogTrigger 
} from "@/components/ui/dialog";

interface DataSource {
  id: string;
  name: string;
  type: string;
  created_at: string;
  metadata?: any;
}

interface SynthesisParameter {
  id: string;
  name: string;
  type: string;
  description?: string;
}

interface SynthesisValue {
  id: string;
  parameter_id: string;
  data_source_id: string;
  value?: string;
  extracted_value?: string;
  confidence?: number;
  is_verified: boolean;
  parameter?: SynthesisParameter;
  dataSource?: DataSource;
}

interface TimelineViewProps {
  dataSources: DataSource[];
  synthesisParameters: SynthesisParameter[];
  synthesisValues: SynthesisValue[];
}

interface TimelineEvent {
  date: Date;
  source: DataSource;
  values: Record<string, string>;
  year: number;
}

export function TimelineView({ 
  dataSources, 
  synthesisParameters, 
  synthesisValues 
}: TimelineViewProps) {
  const [selectedParameter, setSelectedParameter] = useState<string | null>(null);
  const [viewType, setViewType] = useState<'timeline' | 'trends'>('timeline');

  // Process data into timeline events
  const timelineEvents = useMemo(() => {
    const events: TimelineEvent[] = [];
    
    for (const source of dataSources) {
      // Try to extract date from various sources
      let eventDate = new Date(source.created_at);
      
      // Look for date parameters in synthesis values
      const dateValues = synthesisValues.filter(v => 
        v.data_source_id === source.id && 
        v.parameter?.type === 'date' &&
        (v.value || v.extracted_value)
      );
      
      if (dateValues.length > 0) {
        const dateStr = dateValues[0].value || dateValues[0].extracted_value;
        const parsedDate = dateStr ? new Date(dateStr) : null;
        if (parsedDate && !isNaN(parsedDate.getTime())) {
          eventDate = parsedDate;
        }
      }

      // Collect all parameter values for this source
      const sourceValues: Record<string, string> = {};
      synthesisValues
        .filter(v => v.data_source_id === source.id)
        .forEach(v => {
          if (v.parameter?.name) {
            sourceValues[v.parameter.name] = v.value || v.extracted_value || '';
          }
        });

      events.push({
        date: eventDate,
        source,
        values: sourceValues,
        year: eventDate.getFullYear(),
      });
    }

    return events.sort((a, b) => a.date.getTime() - b.date.getTime());
  }, [dataSources, synthesisValues]);

  // Calculate trend data for a specific parameter
  const getTrendData = (parameterName: string) => {
    const valuesByYear: Record<number, string[]> = {};
    
    timelineEvents.forEach(event => {
      const value = event.values[parameterName];
      if (value) {
        if (!valuesByYear[event.year]) {
          valuesByYear[event.year] = [];
        }
        valuesByYear[event.year].push(value);
      }
    });

    return Object.entries(valuesByYear)
      .map(([year, values]) => ({
        year: parseInt(year),
        values,
        uniqueValues: [...new Set(values)],
        count: values.length,
      }))
      .sort((a, b) => a.year - b.year);
  };

  const renderTimelineView = () => (
    <div className="space-y-8">
      {/* Timeline Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">Research Timeline</h3>
          <p className="text-sm text-muted-foreground">
            Chronological view of your {timelineEvents.length} sources
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant={viewType === 'timeline' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setViewType('timeline')}
            className="gap-2"
          >
            <Calendar className="h-4 w-4" />
            Timeline
          </Button>
          <Button
            variant={viewType === 'trends' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setViewType('trends')}
            className="gap-2"
          >
            <TrendingUp className="h-4 w-4" />
            Trends
          </Button>
        </div>
      </div>

      {/* Timeline Content */}
      <div className="relative">
        {/* Timeline line */}
        <div className="absolute left-8 top-0 bottom-0 w-0.5 bg-border"></div>
        
        <div className="space-y-8">
          {timelineEvents.map((event, index) => (
            <div key={event.source.id} className="relative flex items-start gap-6">
              {/* Timeline dot */}
              <div className="relative z-10 flex h-16 w-16 items-center justify-center rounded-full border-4 border-background bg-card shadow-lg">
                <div className="h-8 w-8 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center">
                  <span className="text-xs font-bold text-white">
                    {event.year.toString().slice(-2)}
                  </span>
                </div>
              </div>

              {/* Event card */}
              <div className="flex-1 rounded-lg border border-border bg-card p-6 shadow-sm">
                <div className="mb-3">
                  <h4 className="font-semibold text-lg">{event.source.name}</h4>
                  <div className="flex items-center gap-4 text-sm text-muted-foreground mt-1">
                    <span>{event.date.toLocaleDateString()}</span>
                    <span className="px-2 py-1 rounded-full bg-primary/10 text-primary text-xs">
                      {event.source.type}
                    </span>
                  </div>
                </div>

                {/* Key parameters */}
                {Object.keys(event.values).length > 0 && (
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mt-4">
                    {Object.entries(event.values).slice(0, 6).map(([param, value]) => (
                      <div key={param} className="min-w-0">
                        <div className="text-xs font-medium text-muted-foreground truncate">
                          {param}
                        </div>
                        <div className="text-sm mt-1 truncate" title={value}>
                          {value}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );

  const renderTrendsView = () => (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">Parameter Trends</h3>
          <p className="text-sm text-muted-foreground">
            Visualize how values change over time
          </p>
        </div>
      </div>

      {/* Parameter selector */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {synthesisParameters.slice(0, 8).map((param) => (
          <button
            key={param.id}
            onClick={() => setSelectedParameter(
              selectedParameter === param.name ? null : param.name
            )}
            className={`p-3 rounded-lg border text-left transition-colors ${
              selectedParameter === param.name
                ? 'border-primary bg-primary/5'
                : 'border-border bg-card hover:bg-muted/50'
            }`}
          >
            <div className="font-medium text-sm">{param.name}</div>
            <div className="text-xs text-muted-foreground mt-1">
              {param.type}
            </div>
          </button>
        ))}
      </div>

      {/* Trend visualization */}
      {selectedParameter && (
        <div className="rounded-lg border border-border bg-card p-6">
          <h4 className="font-semibold mb-4">
            Trend Analysis: {selectedParameter}
          </h4>
          
          {(() => {
            const trendData = getTrendData(selectedParameter);
            
            if (trendData.length === 0) {
              return (
                <p className="text-muted-foreground text-center py-8">
                  No data available for this parameter
                </p>
              );
            }

            return (
              <div className="space-y-4">
                {trendData.map((yearData) => (
                  <div key={yearData.year} className="flex items-center gap-4">
                    <div className="w-16 text-sm font-medium">
                      {yearData.year}
                    </div>
                    <div className="flex-1">
                      <div className="flex flex-wrap gap-2">
                        {yearData.uniqueValues.map((value, idx) => (
                          <span
                            key={idx}
                            className="px-2 py-1 rounded text-xs bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300"
                          >
                            {value} ({yearData.values.filter(v => v === value).length})
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>
                ))}
                
                {/* Insight */}
                <div className="mt-6 p-4 rounded-lg bg-muted/50">
                  <div className="flex items-start gap-3">
                    <TrendingUp className="h-5 w-5 text-blue-600 mt-0.5" />
                    <div>
                      <div className="font-medium text-sm">Trend Insight</div>
                      <div className="text-sm text-muted-foreground mt-1">
                        {trendData.length > 1 ? (
                          `Parameter "${selectedParameter}" shows evolution across ${trendData.length} time periods. ` +
                          `Most recent values: ${trendData[trendData.length - 1].uniqueValues.join(', ')}`
                        ) : (
                          `Limited temporal data for "${selectedParameter}".`
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            );
          })()}
        </div>
      )}
    </div>
  );

  if (timelineEvents.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-border bg-card p-12 text-center">
        <Calendar className="h-12 w-12 text-muted-foreground mb-4" />
        <h3 className="text-lg font-semibold mb-2">No timeline data</h3>
        <p className="text-sm text-muted-foreground max-w-sm">
          Add date parameters to your sources to visualize research evolution over time.
        </p>
      </div>
    );
  }

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="outline" className="gap-2">
          <TrendingUp className="h-4 w-4" />
          Timeline View
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Research Timeline & Trends</DialogTitle>
        </DialogHeader>
        <div className="mt-4">
          {viewType === 'timeline' ? renderTimelineView() : renderTrendsView()}
        </div>
      </DialogContent>
    </Dialog>
  );
}