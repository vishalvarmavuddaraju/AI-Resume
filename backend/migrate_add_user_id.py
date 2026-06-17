"""
Backfill user_id on existing evaluations.

Usage:
  python migrate_add_user_id.py --user-id "<USER_ID>" --dry-run
  python migrate_add_user_id.py --user-id "<USER_ID>"

Optional:
  python migrate_add_user_id.py --user-id "<USER_ID>" --only-missing
"""

from __future__ import annotations

import argparse
import os
from pathlib import Path

from dotenv import load_dotenv
from pymongo import MongoClient


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Backfill evaluations.user_id to a provided value.",
    )
    parser.add_argument(
        "--user-id",
        required=True,
        help="User ID to write into matching evaluation records.",
    )
    parser.add_argument(
        "--only-missing",
        action="store_true",
        help="Update only records where user_id does not exist.",
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Print how many records would be updated without writing.",
    )
    return parser.parse_args()


def main() -> None:
    # backend/.env is the source of DB config in this project.
    load_dotenv(Path(__file__).resolve().parent / ".env")

    mongo_url = os.environ.get("MONGO_URL")
    db_name = os.environ.get("DB_NAME")
    if not mongo_url or not db_name:
        raise SystemExit("Missing MONGO_URL or DB_NAME in backend/.env")

    args = parse_args()

    client = MongoClient(mongo_url)
    db = client[db_name]
    evaluations = db["evaluations"]

    query = {"user_id": {"$exists": False}} if args.only_missing else {}
    update = {"$set": {"user_id": args.user_id}}

    matched = evaluations.count_documents(query)
    if args.dry_run:
        print(
            f"[DRY RUN] Would update {matched} document(s) in "
            f"{db_name}.evaluations with user_id='{args.user_id}'."
        )
        return

    result = evaluations.update_many(query, update)
    print(f"Matched: {result.matched_count}")
    print(f"Modified: {result.modified_count}")
    print(
        f"Backfill complete for {db_name}.evaluations "
        f"(user_id='{args.user_id}')."
    )


if __name__ == "__main__":
    main()
