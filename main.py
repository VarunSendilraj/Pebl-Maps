from topicGeneration import generate_topics

# Adding LLM-generated topics/facets to the conversation dataset.
generate_topics(
    input_csv="/Users/vkodithala/Desktop/projects/OpenClio/selected_conversations.csv",
    output_csv="/Users/vkodithala/Desktop/projects/OpenClio/selected_conversations_with_topics.csv",
    column_name="Conversation",
    model="deepseek-chat",
    concurrency=8,
)
