package my.aksara.nativeapp.feature.chat

import my.aksara.nativeapp.core.storage.Message

/**
 * One query searches both session titles and every message in local encrypted history.
 * The UI limits the rendered results, never truncates or rewrites the stored archive.
 */
internal data class UnifiedHistoryMatches(
    val sessions: List<ArchivedConversation>,
    val messages: List<Pair<ArchivedConversation, Message>>
)

internal fun findUnifiedHistory(
    sessions: List<ArchivedConversation>,
    query: String,
    maxResults: Int = 100
): UnifiedHistoryMatches {
    val term = query.trim()
    val limit = maxResults.coerceIn(1, 1000)
    if (term.isBlank()) return UnifiedHistoryMatches(sessions.take(limit), emptyList())
    return UnifiedHistoryMatches(
        sessions.filter { session ->
            session.title.contains(term, ignoreCase = true) ||
                session.messages.any { it.text.contains(term, ignoreCase = true) }
        }.take(limit),
        sessions.asSequence().flatMap { session ->
            session.messages.asSequence()
                .filter { it.text.contains(term, ignoreCase = true) }
                .map { session to it }
        }.take(limit).toList()
    )
}

/** Pure deletion plan: callers must persist it before mutating visible state. */
internal data class SessionRemovalPlan(
    val archive: List<Message>,
    val starts: List<String>,
    val removedIds: Set<String>
)

internal fun planSessionRemoval(
    archive: List<Message>,
    starts: List<String>,
    startId: String
): SessionRemovalPlan? {
    val target = groupSessions(archive, starts).firstOrNull { it.startId == startId }
        ?: return null
    val removed = target.messages.mapTo(HashSet()) { it.id }
    val retained = archive.filterNot { it.id in removed }
    val aliveIds = retained.mapTo(HashSet()) { it.id }
    return SessionRemovalPlan(retained, starts.filter { it in aliveIds }, removed)
}
