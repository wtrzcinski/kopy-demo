export const examples = {
  "Fibonacci": `def fibonacci(n):
    if n <= 1:
        return n
    return fibonacci(n - 1) + fibonacci(n - 2)

for i in range(10):
    print(f"fibonacci({i}) = {fibonacci(i)}")
`,
  "Classes": `class Vector:
    def __init__(self, x, y):
        self.x = x
        self.y = y

    def __add__(self, other):
        return Vector(self.x + other.x, self.y + other.y)

    def __repr__(self):
        return f"Vector({self.x}, {self.y})"

class Point:
    pass

print(Vector(1, 2) + Vector(3, 4))
print(Vector, Point(), type(Point))
`,
  "Collections": `words = "the quick brown fox jumps over the lazy dog".split(" ")
lengths = {word: len(word) for word in words}
print(lengths)
print(sorted(set(words)))
print([w for w in words if len(w) > 4])
print(tuple(zip(range(3), "abc")), list(map(abs, [-1, 2, -3])))
`,
  "Big integers": `import math

print(2 ** 100)
print(math.sqrt(2), math.pi)
print(divmod(10 ** 20 + 7, 3), hex(255), bin(10))
`,
  "Expense splitter": `LEDGER = """
# who     action  amount  what       split between
alice     paid    312.60  cabin      alice bob carol dave
bob       paid     84.15  groceries  alice bob carol dave
carol     paid     47.00  fuel       carol dave
dave      paid     18.90  ferry      alice bob
bob       refund   12.00  groceries  alice bob carol dave
# deliberate bad amount: this row is skipped
erin      paid     abc    snacks     alice
"""


class Expense:
    def __init__(self, payer, cents, label, people):
        if not people:
            raise ValueError(f"{label}: nobody to split it with")
        self.payer, self.cents, self.label, self.people = payer, cents, label, people

    def shares(self):
        base, extra = divmod(self.cents, len(self.people))
        return {person: base + (1 if i < extra else 0) for i, person in enumerate(self.people)}


def to_cents(text):
    whole, _, frac = text.partition(".")
    return int(whole) * 100 + int((frac + "00")[:2])


def parse(line):
    match line.split():
        case [payer, "paid", amount, label, *people]:
            return Expense(payer, to_cents(amount), label, people)
        case [payer, "refund", amount, label, *people]:
            return Expense(payer, -to_cents(amount), label, people)
        case _:
            raise ValueError(f"cannot read {line!r}")


def money(cents):
    sign = "-" if cents < 0 else ""
    return f"{sign}{abs(cents) // 100}.{abs(cents) % 100:02d}"


expenses, balances = [], {}
for number, line in enumerate(LEDGER.strip().split("\\n"), start=1):
    if line.startswith("#"):
        continue
    try:
        expense = parse(line)
    except ValueError as error:
        print(f"line {number} skipped: {error}")
        continue
    expenses.append(expense)
    balances[expense.payer] = balances.get(expense.payer, 0) + expense.cents
    for person, share in expense.shares().items():
        balances[person] = balances.get(person, 0) - share

total = sum(e.cents for e in expenses)
print(f"{len(expenses)} expenses, {money(total)} in total")
for person, cents in sorted(balances.items(), key=lambda item: item[1], reverse=True):
    print(f"  {person:<6}{money(cents):>8}")

debtors = [[p, -c] for p, c in sorted(balances.items(), key=lambda item: item[1]) if c < 0]
creditors = [[p, c] for p, c in sorted(balances.items(), key=lambda item: -item[1]) if c > 0]
while debtors and creditors:
    debtor, creditor = debtors[0], creditors[0]
    amount = min(debtor[1], creditor[1])
    print(f"{debtor[0]} pays {creditor[0]} {money(amount)}")
    debtor[1] -= amount
    creditor[1] -= amount
    if debtor[1] == 0:
        debtors.pop(0)
    if creditor[1] == 0:
        creditors.pop(0)
`,
  "Onboarding workflow": `HOUR = 1
DAY = 24 * HOUR
clock = 0


def wait(hours):
    global clock
    delay(hours)
    clock += hours


def log(message):
    print(f"day {clock // DAY} {clock % DAY:02d}:00  {message}")


class MailServerDown(Exception):
    pass


outages = {"tips": 2}


def send_email(user, template):
    if outages.get(template, 0) > 0:
        outages[template] -= 1
        raise MailServerDown(f"cannot send {template!r}")
    log(f"sent {template!r} to {user['email']}")


def send_with_retry(user, template, attempts=4):
    for attempt in range(attempts):
        try:
            send_email(user, template)
            return True
        except MailServerDown as error:
            backoff = 2 ** attempt * HOUR
            log(f"{error}, retrying in {backoff}h")
            wait(backoff)
    log(f"gave up on {template!r}")
    return False


def onboard(user):
    send_with_retry(user, "welcome")
    wait(1 * DAY)
    send_with_retry(user, "tips")
    wait(2 * DAY)
    if user["projects"] == 0:
        send_with_retry(user, "need help?")
    else:
        log(f"{user['name']} is active, skipping the nudge")


onboard({"name": "Ada", "email": "ada@example.com", "projects": 0})
`,
};
