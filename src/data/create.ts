import { Repository } from "./repository.ts";
import { IndexedDbAdapter } from "./indexeddb.ts";
import { SqlAdapter } from "./sql.ts";
import { isNative, nativeRequest } from "../platform/native.ts";
export function createRepository() {
  return new Repository(
    isNative()
      ? new SqlAdapter({
          read: (queries) => nativeRequest("db.read", { queries }),
          commit: (expected, statements) =>
            nativeRequest("db.commit", { expected, statements }),
        })
      : new IndexedDbAdapter(),
  );
}
