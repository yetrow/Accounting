import { createContext, useContext } from "react";
import type { Repository, RecordState } from "../data/repository";
import type { Command } from "../domain/book";
interface Store extends RecordState {
  repository: Repository;
  busy: boolean;
  error: string;
  dismiss: () => void;
  run: (task: () => Promise<RecordState>) => Promise<boolean>;
  dispatch: (command: Command) => Promise<boolean>;
}
export const Context = createContext<Store | null>(null);
export function useBook() {
  const ctx = useContext(Context);
  if (!ctx) throw new Error("Missing Bill provider");
  return ctx;
}
