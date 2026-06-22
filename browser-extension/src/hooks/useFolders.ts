import { useState, useEffect } from "react";
import { supabase } from "../lib/supabase";

export interface FolderOption {
  id: string;
  name: string;
  depth: number;
}

export function useFolders(): FolderOption[] {
  const [folders, setFolders] = useState<FolderOption[]>([]);

  useEffect(() => {
    supabase
      .from("folders")
      .select("id, name, parent_id, order_index")
      .order("order_index")
      .then(({ data }) => {
        if (!data) return;
        const rows = data;
        const depthMap = new Map<string, number>();
        function getDepth(id: string): number {
          if (depthMap.has(id)) return depthMap.get(id)!;
          const folder = rows.find(
            (f: { id: string; parent_id: string | null }) => f.id === id
          );
          if (!folder?.parent_id) {
            depthMap.set(id, 0);
            return 0;
          }
          const d = getDepth(folder.parent_id) + 1;
          depthMap.set(id, d);
          return d;
        }
        setFolders(
          rows.map((f: { id: string; name: string }) => ({
            id: f.id,
            name: f.name,
            depth: getDepth(f.id),
          }))
        );
      });
  }, []);

  return folders;
}
