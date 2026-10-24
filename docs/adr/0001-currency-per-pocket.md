# Currency is set per pocket

Each pocket has its own currency, so a household can keep, say, a THB personal pocket and a JPY travel pocket on one instance. Amounts are never converted: changing a pocket's currency only relabels its amounts, and any total that spans pockets is shown per currency, never summed across currencies. New pockets start from the instance's default currency.

## Considered Options

- **Per instance**: one currency for the whole household. Simpler, but rules out travel or foreign-currency pockets.
- **Per member**: breaks shared pockets whose members pick different currencies.
- **Conversion with exchange rates**: needs a rate source and history, and turns a limit tracker into a ledger.
