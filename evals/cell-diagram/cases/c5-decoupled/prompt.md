Two cells, and they depend on each other in both directions.

The Checkout cell has a Checkout API. The Loyalty cell has a Points Service.

Checkout calls Loyalty to burn points during checkout. Loyalty calls back into
Checkout to look up order totals when it recalculates a member's tier.

Draw this. Because the dependency is cyclic, don't render one of the two links
as a line crossing the diagram — use the escape hatch the DSL provides for
that.
