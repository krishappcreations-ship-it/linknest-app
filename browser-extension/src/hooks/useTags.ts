import { useState, useEffect } from "react";
import { supabase } from "../lib/supabase";

export interface TagOption {
  id: string;
  name: string;
  color: string;
}

export function useTags(): TagOption[] {
  const [tags, setTags] = useState<TagOption[]>([]);

  useEffect(() => {
    supabase
      .from("tags")
      .select("id, name, color")
      .order("name")
      .then(({ data }) => {
        if (data) setTags(data as TagOption[]);
      });
  }, []);

  return tags;
}
