package com.ustatakip.tadilat.widget

import android.content.Context
import android.content.Intent
import android.graphics.Color
import android.view.View
import android.widget.RemoteViews
import android.widget.RemoteViewsService
import com.google.android.gms.tasks.Tasks
import com.google.firebase.FirebaseApp
import com.google.firebase.auth.FirebaseAuth
import com.google.firebase.firestore.FirebaseFirestore
import com.google.firebase.firestore.Query

class WidgetTasksService : RemoteViewsService() {
    override fun onGetViewFactory(intent: Intent): RemoteViewsFactory {
        return WidgetTasksFactory(this.applicationContext)
    }
}

class WidgetTasksFactory(private val context: Context) : RemoteViewsService.RemoteViewsFactory {

    private val tasksList = ArrayList<TaskItem>()
    private val projectsMap = HashMap<String, String>() // Map projectID -> projectName

    override fun onCreate() {
        // Initial setup
    }

    override fun onDataSetChanged() {
        // This is called on a background worker thread. Fetch Firestore synchronously.
        tasksList.clear()
        projectsMap.clear()

        try {
            if (FirebaseApp.getApps(context).isEmpty()) {
                FirebaseApp.initializeApp(context)
            }

            val auth = FirebaseAuth.getInstance()
            val userId = auth.currentUser?.uid ?: return

            val db = FirebaseFirestore.getInstance(FirebaseApp.getInstance(), RenovationWidgetProvider.DATABASE_ID)

            // 1. Fetch all user projects to map project details (names)
            val projectsQuery = db.collection("projects")
                .whereEqualTo("userId", userId)
                .get()
            val projectsSnapshot = Tasks.await(projectsQuery)
            for (doc in projectsSnapshot.documents) {
                val pId = doc.id
                val pName = doc.getString("name") ?: ""
                projectsMap[pId] = pName
            }

            // 2. Fetch all "todo"(pending) tasks, sorting by priority
            // Let's load the tasks
            val tasksQuery = db.collection("tasks")
                .whereEqualTo("userId", userId)
                .whereEqualTo("status", "todo")
                .get()
            val tasksSnapshot = Tasks.await(tasksQuery)

            val rawTasks = ArrayList<TaskItem>()
            for (doc in tasksSnapshot.documents) {
                val id = doc.id
                val projectId = doc.getString("projectId") ?: ""
                val title = doc.getString("title") ?: "İsimsiz Görev"
                val priority = doc.getString("priority") ?: "medium"
                val dueDate = doc.getString("dueDate") ?: ""

                val projectName = projectsMap[projectId] ?: "Bilinmeyen Proje"

                rawTasks.add(TaskItem(id, title, priority, dueDate, projectName))
            }

            // Sort logically: urgent (0), high (1), medium (2), low (3)
            rawTasks.sortWith(Comparator { t1, t2 ->
                val p1 = getPriorityWeight(t1.priority)
                val p2 = getPriorityWeight(t2.priority)
                p1.compareTo(p2)
            })

            tasksList.addAll(rawTasks)

        } catch (e: Exception) {
            e.printStackTrace()
        }
    }

    private fun getPriorityWeight(pri: String): Int {
        return when (pri.lowercase()) {
            "urgent" -> 0
            "high" -> 1
            "medium" -> 2
            "low" -> 3
            else -> 2
        }
    }

    override fun onDestroy() {
        tasksList.clear()
        projectsMap.clear()
    }

    override fun getCount(): Int = tasksList.size

    override fun getViewAt(position: Int): RemoteViews? {
        if (position >= tasksList.size) return null

        val item = tasksList[position]
        val views = RemoteViews(context.packageName, R.layout.widget_item_task)

        // Set text
        views.setTextViewText(R.id.task_title, item.title)
        views.setTextViewText(R.id.task_subtitle, item.projectName)
        views.setTextViewText(R.id.task_due, item.dueDate)

        // Map and translate priority tags matching local styles
        val labelTr = when (item.priority.lowercase()) {
            "low" -> "DÜŞÜK"
            "medium" -> "ORTA"
            "high" -> "YÜKSEK"
            "urgent" -> "ACİL"
            else -> "ORTA"
        }

        views.setTextViewText(R.id.task_priority_badge, labelTr)

        // Apply visual priority colors on background tint in RemoteViews
        val badgeColor = when (item.priority.lowercase()) {
            "low" -> Color.parseColor("#475569") // Gray
            "medium" -> Color.parseColor("#3B82F6") // Blue
            "high" -> Color.parseColor("#F59E0B") // Amber
            "urgent" -> Color.parseColor("#EF4444") // Red
            else -> Color.parseColor("#3B82F6")
        }

        views.setInt(R.id.task_priority_badge, "setBackgroundColor", badgeColor)

        return views
    }

    override fun getLoadingView(): RemoteViews? {
        // Can return a default placeholder
        return null
    }

    override fun getViewTypeCount(): Int = 1

    override fun getItemId(position: Int): Long = position.toLong()

    override fun hasStableIds(): Boolean = true
}

data class TaskItem(
    val id: String,
    val title: String,
    val priority: String,
    val dueDate: String,
    val projectName: String
)
