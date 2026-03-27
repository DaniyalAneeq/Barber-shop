"""
Shared run-context passed to every agent and tool in a single Runner.run() call.
The RunContextWrapper wraps this and is injected as the first parameter of any
tool function that declares it — the LLM never sees or provides these values.
"""
from dataclasses import dataclass


@dataclass
class AppContext:
    customer_id: str    # UUID string — FK to users.id
    customer_email: str # for sending confirmation emails
    customer_name: str  # for personalised greetings
