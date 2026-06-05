type DatabaseRecordMap = Record<string, string>;

interface GittrackDatabase {
  schemaVersion: 1;
  migratedAt?: string;
  updatedAt: string;
  records: DatabaseRecordMap;
}

const DATABASE_KEY = "gittrack.database";

function createEmptyDatabase(): GittrackDatabase {
  const now = new Date().toISOString();

  return {
    schemaVersion: 1,
    updatedAt: now,
    records: {},
  };
}

function canUseStorage() {
  return typeof window !== "undefined" && Boolean(window.localStorage);
}

function readDatabase(): GittrackDatabase {
  if (!canUseStorage()) return createEmptyDatabase();

  try {
    const raw = window.localStorage.getItem(DATABASE_KEY);
    if (!raw) return createEmptyDatabase();

    const parsed = JSON.parse(raw) as Partial<GittrackDatabase>;
    if (parsed.schemaVersion !== 1 || typeof parsed.records !== "object" || !parsed.records) {
      return createEmptyDatabase();
    }

    return {
      schemaVersion: 1,
      migratedAt: typeof parsed.migratedAt === "string" ? parsed.migratedAt : undefined,
      updatedAt: typeof parsed.updatedAt === "string" ? parsed.updatedAt : new Date().toISOString(),
      records: Object.fromEntries(
        Object.entries(parsed.records).filter((entry): entry is [string, string] => typeof entry[1] === "string"),
      ),
    };
  } catch {
    return createEmptyDatabase();
  }
}

function writeDatabase(database: GittrackDatabase) {
  if (!canUseStorage()) return;

  window.localStorage.setItem(
    DATABASE_KEY,
    JSON.stringify({
      ...database,
      updatedAt: new Date().toISOString(),
    }),
  );
}

export function migrateAppDatabase(legacyKeys: string[]) {
  if (!canUseStorage()) return;

  const database = readDatabase();
  if (database.migratedAt) return;

  const records = { ...database.records };
  legacyKeys.forEach((key) => {
    if (records[key] !== undefined) return;

    const legacyValue = window.localStorage.getItem(key);
    if (legacyValue !== null) records[key] = legacyValue;
  });

  writeDatabase({
    ...database,
    migratedAt: new Date().toISOString(),
    records,
  });
}

export function readDatabaseValue(key: string) {
  const database = readDatabase();
  if (database.records[key] !== undefined) return database.records[key];

  if (!canUseStorage()) return null;
  return window.localStorage.getItem(key);
}

export function writeDatabaseValue(key: string, value: string) {
  const database = readDatabase();

  writeDatabase({
    ...database,
    records: {
      ...database.records,
      [key]: value,
    },
  });
}

export function deleteDatabaseValue(key: string) {
  const database = readDatabase();
  const records = { ...database.records };
  delete records[key];

  writeDatabase({
    ...database,
    records,
  });
}
