# Data Path Fix - 2025-10-01

## Problem Identified

Entity data was being written to `/home/robforee/analyst-server/data/` (outside the repo) instead of `/home/robforee/analyst-server/entity-extraction-poc/data/` (inside the repo).

### Root Cause

Multiple source files used `path.join(__dirname, '../../data')` which resolved to the parent directory:
- From `src/routing/` → `../../data` → `/home/robforee/analyst-server/data/`
- From `src/api/` → `../../data` → `/home/robforee/analyst-server/data/`

This created data **outside the repo**, leading to:
- Data not version-controlled
- Confusion about data location
- Potential data loss during repo operations

## Solution Implemented

### 1. Fixed Path References

Changed all `path.join(__dirname, '../../data')` to `path.join(process.cwd(), 'data')` in:

- ✅ `src/api/server.js` - Line 29
- ✅ `src/api/context-api-server.js` - Line 28
- ✅ `src/server/enhanced-viz-server.js` - Lines 33, 1720, 1738
- ✅ `src/server/enhanced-viz-server-refactored.js` - Lines 35, 182

**Already correct** (using `process.cwd()`):
- `src/routing/data-source-router.js`
- `src/system/command-logger.js`
- `src/context/context-resolver.js`
- `src/context/persistent-conversation-manager.js`
- `src/entities/hierarchical-entity-manager.js`
- `src/consolidation/entity-consolidator.js`
- `src/queries/query-template-manager.js`
- `src/knowledge/knowledge-driller.js`

### 2. Migrated Data

Moved all entity data from `/home/robforee/analyst-server/data/` into the repo:

```bash
rsync -av /home/robforee/analyst-server/data/ /home/robforee/analyst-server/entity-extraction-poc/data/
```

**Data migrated:**
- `construction/entities/location/` - 4 location entities
- `construction/entities/person/` - 1 person entity (john-green.json)
- `construction/entities/project/` - 4 project entities
- `system/entities/command_execution/` - 25 command execution logs

**Total:** 34 files successfully migrated

### 3. Verification

- ✅ No more `__dirname` references to `../../data` in src/
- ✅ 20+ files now correctly use `process.cwd()` + 'data'
- ✅ All entity data now in repo at `./data/`
- ✅ Data structure preserved during migration

## Current Data Structure

```
entity-extraction-poc/data/
├── construction/
│   └── entities/
│       ├── location/     (4 files)
│       ├── person/       (1 file)
│       └── project/      (4 files)
├── system/
│   └── entities/
│       └── command_execution/  (25 files)
├── snappy-sync/          (empty)
├── snappy-cache/
├── cybersec/
├── mock-diffmem/
└── [50+ backup directories]
```

## Next Steps (Optional)

### Clean Up Old Data Directory

The old data directory at `/home/robforee/analyst-server/data/` can now be safely removed:

```bash
# Verify no new data is being written there
ls -lah /home/robforee/analyst-server/data/

# If confirmed empty or only contains migrated data, remove it
rm -rf /home/robforee/analyst-server/data/
```

### Update .gitignore

Ensure the repo's `.gitignore` properly handles the data directory:

```gitignore
# Entity data (keep structure, ignore content)
data/*/entities/**/*.json
data/backup-*
data/snappy-cache/
data/snappy-sync/

# Keep directory structure
!data/construction/entities/.gitkeep
!data/system/entities/.gitkeep
```

## Benefits

1. **Data Portability** - All data stays with the repo
2. **Version Control** - Can track data structure changes
3. **Consistency** - Single source of truth for data location
4. **Clarity** - No confusion about where data is stored
5. **Safety** - Data won't be lost during repo operations

## Testing

To verify the fix works:

```bash
# Run any entity extraction or smart router test
node test-smart-router.js

# Check that new data is written to ./data/ not ../data/
find ./data -type f -name "*.json" -mmin -5

# Verify nothing is written outside repo
find ../data -type f -name "*.json" -mmin -5  # Should be empty
```
