# # db.py
# import os
# from motor.motor_asyncio import AsyncIOMotorClient
# from dotenv import load_dotenv

# load_dotenv()

# MONGODB_URI = os.getenv("MONGODB_URI")
# client = AsyncIOMotorClient(MONGODB_URI)

# # Set database and collection
# db = client.video_analysis  # you can rename this to whatever you want
# collection = db.analyses    # your main collection