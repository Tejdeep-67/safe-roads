from pymongo import MongoClient
from bson.objectid import ObjectId

client = MongoClient('mongodb://localhost:27017')
db = client['pothole_detection']

# Mark the reported pothole as verified
pothole_id = ObjectId('699d78bafce1d82026d91a7e')
result = db['potholes'].update_one(
    {'_id': pothole_id},
    {'$set': {'verified': True}}
)

print(f"Updated {result.modified_count} document(s)")

# Verify it was updated
pothole = db['potholes'].find_one({'_id': pothole_id})
print(f"\nVerified status: {pothole.get('verified')}")
print(f"Location: {pothole.get('latitude')}, {pothole.get('longitude')}")
