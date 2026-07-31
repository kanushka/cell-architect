Diagram our Search cell.

It has a Search API and an Indexer. The Indexer reads from an internal Index
Store that we own.

The Search API is published on the public internet, but we don't know or care
who the callers are — it's an open API, any client can use it.

The Indexer pushes documents out to an object store run by another team on our
platform. Again, the specific system is not decided yet, we just know traffic
leaves that way.
