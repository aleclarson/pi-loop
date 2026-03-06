import useSWR from "swr";
import { clickupService } from "../services/clickup";
import { Space, List, Task } from "../types";

const SWR_CONFIG = {
  refreshInterval: 5000,
  revalidateOnFocus: true,
  dedupingInterval: 2000, // Prevent duplicate requests within a short time
};

export function useSpaces() {
  const { data, error, isLoading } = useSWR<Space[]>(
    "spaces",
    () => clickupService.getSpaces(),
    SWR_CONFIG,
  );

  return {
    spaces: data || [],
    isLoading,
    isError: error,
  };
}

export function useLists(spaceId: string | null) {
  const { data, error, isLoading } = useSWR<List[]>(
    spaceId ? `lists-${spaceId}` : null,
    () => (spaceId ? clickupService.getLists(spaceId) : Promise.resolve([])),
    SWR_CONFIG,
  );

  return {
    lists: data || [],
    isLoading,
    isError: error,
  };
}

export function useTasks(listId: string | null) {
  const { data, error, isLoading } = useSWR<Task[]>(
    listId ? `tasks-${listId}` : null,
    () => (listId ? clickupService.getTasks(listId) : Promise.resolve([])),
    SWR_CONFIG,
  );

  return {
    tasks: data || [],
    isLoading,
    isError: error,
  };
}
