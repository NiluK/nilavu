"use client";

import { useState, useTransition } from "react";
import { Plus, Edit, Check, X, Brain, Clock, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogTrigger 
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";

interface DataSource {
  id: string;
  name: string;
  type: string;
  created_at: string;
  metadata?: any;
}

interface SynthesisParameter {
  id: string;
  project_id: string;
  name: string;
  type: string;
  description?: string;
  is_system: boolean;
  display_order: number;
}

interface SynthesisValue {
  id: string;
  parameter_id: string;
  data_source_id: string;
  value?: string;
  extracted_value?: string;
  confidence?: number;
  context?: string;
  is_verified: boolean;
  parameter?: SynthesisParameter;
  dataSource?: DataSource;
}

interface SynthesisTableProps {
  projectId: string;
  dataSources: DataSource[];
  synthesisParameters: SynthesisParameter[];
  synthesisValues: SynthesisValue[];
}

export function SynthesisTable({ 
  projectId, 
  dataSources, 
  synthesisParameters, 
  synthesisValues 
}: SynthesisTableProps) {
  const [isAddingParameter, setIsAddingParameter] = useState(false);
  const [editingCell, setEditingCell] = useState<{
    dataSourceId: string;
    parameterId: string;
  } | null>(null);
  const [editValue, setEditValue] = useState("");
  const [isPending, startTransition] = useTransition();
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  // Create a lookup map for synthesis values
  const valuesMap = new Map<string, SynthesisValue>();
  synthesisValues.forEach(value => {
    const key = `${value.data_source_id}-${value.parameter_id}`;
    valuesMap.set(key, value);
  });

  // Get value for a specific cell
  const getCellValue = (dataSourceId: string, parameterId: string): SynthesisValue | undefined => {
    const key = `${dataSourceId}-${parameterId}`;
    return valuesMap.get(key);
  };

  const startEditing = (dataSourceId: string, parameterId: string) => {
    const currentValue = getCellValue(dataSourceId, parameterId);
    setEditValue(currentValue?.value || currentValue?.extracted_value || "");
    setEditingCell({ dataSourceId, parameterId });
  };

  const cancelEditing = () => {
    setEditingCell(null);
    setEditValue("");
  };

  const saveCell = () => {
    if (!editingCell) return;
    
    // TODO: Implement save to database
    console.log("Saving cell:", editingCell, editValue);
    
    setEditingCell(null);
    setEditValue("");
  };

  const analyzeAndSuggestParameters = async () => {
    setIsAnalyzing(true);
    try {
      const response = await fetch('/api/synthesis/analyze-sources', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ projectId }),
      });

      if (!response.ok) {
        throw new Error('Analysis failed');
      }

      const result = await response.json();
      console.log("Analysis result:", result);
      
      // Refresh the page to show new parameters
      window.location.reload();
    } catch (error) {
      console.error("Analysis error:", error);
      alert("Failed to analyze sources. Please try again.");
    } finally {
      setIsAnalyzing(false);
    }
  };

  const renderConfidenceIndicator = (confidence?: number) => {
    if (!confidence) return null;
    
    const level = confidence >= 0.8 ? 'high' : confidence >= 0.6 ? 'medium' : 'low';
    const color = level === 'high' ? 'text-green-600' : 
                  level === 'medium' ? 'text-yellow-600' : 'text-red-600';
    
    return (
      <div className={`inline-flex items-center gap-1 text-xs ${color}`}>
        <Brain className="h-3 w-3" />
        {Math.round(confidence * 100)}%
      </div>
    );
  };

  const renderCell = (dataSource: DataSource, parameter: SynthesisParameter) => {
    const cellValue = getCellValue(dataSource.id, parameter.id);
    const isEditing = editingCell?.dataSourceId === dataSource.id && 
                     editingCell?.parameterId === parameter.id;

    if (isEditing) {
      return (
        <div className="flex items-center gap-2 min-w-0">
          <Input
            value={editValue}
            onChange={(e) => setEditValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') saveCell();
              if (e.key === 'Escape') cancelEditing();
            }}
            className="h-8 text-sm"
            autoFocus
          />
          <Button size="sm" variant="ghost" onClick={saveCell}>
            <Check className="h-3 w-3" />
          </Button>
          <Button size="sm" variant="ghost" onClick={cancelEditing}>
            <X className="h-3 w-3" />
          </Button>
        </div>
      );
    }

    const displayValue = cellValue?.value || cellValue?.extracted_value || "";
    const isAiExtracted = cellValue?.extracted_value && !cellValue?.is_verified;

    return (
      <div 
        className="group flex items-center justify-between min-h-[32px] cursor-pointer hover:bg-muted/50 rounded px-2 -mx-2 min-w-0"
        onClick={() => startEditing(dataSource.id, parameter.id)}
      >
        <div className="flex-1 min-w-0">
          <div className={`text-sm truncate ${isAiExtracted ? 'text-muted-foreground italic' : ''}`}>
            {displayValue || (
              <span className="text-muted-foreground">Click to add</span>
            )}
          </div>
          {cellValue?.confidence && (
            <div className="mt-1">
              {renderConfidenceIndicator(cellValue.confidence)}
            </div>
          )}
        </div>
        <div className="opacity-0 group-hover:opacity-100 transition-opacity">
          <Edit className="h-3 w-3 text-muted-foreground" />
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      {/* Parameter Management */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">Synthesis Matrix</h3>
          <p className="text-sm text-muted-foreground">
            Track key parameters across your data sources
          </p>
        </div>
        
        <Dialog>
          <DialogTrigger asChild>
            <Button className="gap-2">
              <Plus className="h-4 w-4" />
              Add Parameter
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add New Parameter</DialogTitle>
            </DialogHeader>
            <form className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="param-name">Parameter Name</Label>
                <Input
                  id="param-name"
                  placeholder="e.g., Publication Year, Technology Maturity"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="param-type">Type</Label>
                <select 
                  id="param-type"
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background"
                >
                  <option value="text">Text</option>
                  <option value="number">Number</option>
                  <option value="date">Date</option>
                  <option value="category">Category</option>
                </select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="param-desc">Description (optional)</Label>
                <Input
                  id="param-desc"
                  placeholder="Brief description of what this tracks"
                />
              </div>
              <div className="flex justify-end gap-3">
                <Button type="button" variant="outline">Cancel</Button>
                <Button type="submit">Add Parameter</Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* The Synthesis Table */}
      {synthesisParameters.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-border bg-card p-12 text-center">
          <div className="rounded-full bg-muted p-4">
            <Plus className="h-8 w-8 text-muted-foreground" />
          </div>
          <h3 className="mt-4 text-lg font-semibold">No parameters yet</h3>
          <p className="mt-2 text-sm text-muted-foreground max-w-sm mb-6">
            Add your first parameter to start tracking information across your sources.
          </p>
          <Button className="gap-2">
            <Plus className="h-4 w-4" />
            Add Parameter
          </Button>
        </div>
      ) : (
        <div className="border border-border rounded-lg bg-card overflow-hidden">
          {/* Table Header */}
          <div className="bg-muted/50 border-b border-border">
            <div className="flex">
              <div className="w-64 px-6 py-3 font-medium text-sm border-r border-border">
                Source Document
              </div>
              {synthesisParameters.map((param) => (
                <div key={param.id} className="min-w-[200px] px-4 py-3 border-r border-border last:border-r-0">
                  <div className="font-medium text-sm">{param.name}</div>
                  {param.description && (
                    <div className="text-xs text-muted-foreground mt-1">
                      {param.description}
                    </div>
                  )}
                  {param.is_system && (
                    <div className="flex items-center gap-1 mt-1">
                      <Brain className="h-3 w-3 text-blue-500" />
                      <span className="text-xs text-blue-600">AI Discovered</span>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Table Body */}
          <div className="divide-y divide-border">
            {dataSources.map((source) => (
              <div key={source.id} className="flex hover:bg-muted/25 transition-colors">
                <div className="w-64 px-6 py-4 border-r border-border">
                  <div className="font-medium text-sm truncate">{source.name}</div>
                  <div className="text-xs text-muted-foreground mt-1">
                    {source.type} • {new Date(source.created_at).toLocaleDateString()}
                  </div>
                </div>
                {synthesisParameters.map((param) => (
                  <div key={param.id} className="min-w-[200px] px-4 py-4 border-r border-border last:border-r-0">
                    {renderCell(source, param)}
                  </div>
                ))}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* AI Assistance Panel */}
      <div className="rounded-lg border border-blue-200 bg-blue-50/50 dark:border-blue-800 dark:bg-blue-950/20 p-4">
        <div className="flex items-start gap-3">
          <div className="rounded-full bg-blue-100 p-2 dark:bg-blue-900/50">
            <Brain className="h-4 w-4 text-blue-600 dark:text-blue-400" />
          </div>
          <div className="flex-1">
            <h4 className="font-medium text-sm text-blue-900 dark:text-blue-100">
              AI Parameter Suggestions
            </h4>
            <p className="text-sm text-blue-800 dark:text-blue-200 mt-1">
              Based on your documents, I can suggest relevant parameters to track. 
              Click below to analyze your sources and discover key dimensions.
            </p>
            <Button 
              size="sm" 
              variant="outline" 
              className="mt-3 gap-2" 
              onClick={analyzeAndSuggestParameters}
              disabled={isAnalyzing}
            >
              <Brain className="h-3 w-3" />
              {isAnalyzing ? "Analyzing Sources..." : "Analyze & Suggest Parameters"}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}