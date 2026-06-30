from pymongo import MongoClient
from bson.objectid import ObjectId

client = MongoClient('mongodb://localhost:27017')
db = client['pothole_detection']

# IDs of test potholes to delete (all Delhi ones)
test_ids = [
    '699e6e11df86ff2c39269a45',  # Delhi 1
    '699e6e70df86ff2c39269a47',  # Delhi 2
    '699e6e70df86ff2c39269a49',  # Delhi 3
    '699e6e70df86ff2c39269a4b',  # Delhi 4
]

# Convert string IDs to ObjectId and delete
for id_str in test_ids:
    result = db['potholes'].delete_one({'_id': ObjectId(id_str)})
    print(f"Deleted {id_str}: {result.deleted_count} document(s)")

# Verify remaining potholes
remaining = list(db['potholes'].find({}))
print(f"\nRemaining potholes in database: {len(remaining)}")
for pothole in remaining:
    print(f"\nID: {pothole.get('_id')}")
    print(f"Location: {pothole.get('latitude')}, {pothole.get('longitude')}")
    print(f"Confidence: {pothole.get('confidence')}")
    print(f"Severity: {pothole.get('severity')}")
    print(f"Verified: {pothole.get('verified')}")
