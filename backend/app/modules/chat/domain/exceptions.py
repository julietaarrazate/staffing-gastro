"""Excepciones del dominio de chat."""


class ChatError(Exception):
    """Excepción base del módulo chat."""


class ConversationNotFoundError(ChatError):
    """No existe una conversación accesible para el turno y usuario dados.

    Se usa también cuando el usuario no es participante del turno: no se
    distingue "no existe" de "no es tuyo" (no-disclosure).
    """


class EmptyMessageError(ChatError):
    """No se puede enviar un mensaje vacío."""
