import argparse
import asyncio
import os
from pipeline.generate_topics import generate_topics
from pipeline.embed_topics import embed_topics
from pipeline.cluster import process_clustering
from pipeline.upsert import upsert_to_pinecone
from dotenv import load_dotenv

load_dotenv()


def main():
    parser = argparse.ArgumentParser(description="OpenClio Ingestion Pipeline")
    parser.add_argument("--input", required=True, help="Input CSV file path")
    parser.add_argument(
        "--output_dir", default="./output", help="Directory for intermediate files"
    )
    parser.add_argument(
        "--conversation_col",
        default="Conversation",
        help="Column name for conversation text",
    )
    parser.add_argument(
        "--skip_generation", action="store_true", help="Skip topic generation step"
    )
    parser.add_argument(
        "--skip_embedding", action="store_true", help="Skip topic embedding step"
    )
    parser.add_argument(
        "--skip_clustering", action="store_true", help="Skip clustering step"
    )

    args = parser.parse_args()

    os.makedirs(args.output_dir, exist_ok=True)

    step1_csv = os.path.join(args.output_dir, "step1_topics.csv")
    step2_csv = os.path.join(args.output_dir, "step2_embedded.csv")
    step3_csv = os.path.join(args.output_dir, "step3_clustered.csv")

    # Step 1: Generate Topics
    if not args.skip_generation:
        print("\n=== Step 1: Generating Topics ===")
        # Note: generate_topics is synchronous wrapper around async
        generate_topics(
            input_csv=args.input,
            output_csv=step1_csv,
            column_name=args.conversation_col,
        )
    else:
        print("Skipping Step 1...")

    # Step 2: Embed Topics
    if not args.skip_embedding:
        print("\n=== Step 2: Embedding Topics ===")
        # embed_topics is async, wrapped in asyncio.run inside the file's main, but here we import the function
        # The imported embed_topics is async, we need to run it.
        asyncio.run(
            embed_topics(
                input_csv=(
                    step1_csv if not args.skip_generation else args.input
                ),  # Fallback if user provides prepared csv
                output_csv=step2_csv,
            )
        )
    else:
        print("Skipping Step 2...")

    # Step 3: Cluster & Label
    if not args.skip_clustering:
        print("\n=== Step 3: Clustering & Labeling ===")
        asyncio.run(
            process_clustering(
                input_csv=step2_csv if not args.skip_embedding else args.input,
                output_csv=step3_csv,
            )
        )
    else:
        print("Skipping Step 3...")

    # Step 4: Upsert
    print("\n=== Step 4: Upserting to Pinecone ===")
    upsert_to_pinecone(input_csv=step3_csv if not args.skip_clustering else args.input)

    print("\nPipeline Complete!")


if __name__ == "__main__":
    main()
