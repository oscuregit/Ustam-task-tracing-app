package com.ustatakip.tadilat.widget

import android.app.PendingIntent
import android.appwidget.AppWidgetManager
import android.appwidget.AppWidgetProvider
import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.net.Uri
import android.view.View
import android.widget.RemoteViews
import com.google.android.gms.tasks.Tasks
import com.google.firebase.FirebaseApp
import com.google.firebase.auth.FirebaseAuth
import com.google.firebase.firestore.FirebaseFirestore
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.launch
import java.text.SimpleDateFormat
import java.util.*

class RenovationWidgetProvider : AppWidgetProvider() {

    private val job = SupervisorJob()
    private val scope = CoroutineScope(Dispatchers.Main + job)

    companion object {
        const val DATABASE_ID = "ai-studio-84ad73bc-3066-4a3f-bd96-51d84f74f838"
    }

    override fun onUpdate(context: Context, appWidgetManager: AppWidgetManager, appWidgetIds: IntArray) {
        // Run database fetch query outside the main UI thread using Coroutines
        scope.launch(Dispatchers.IO) {
            val stats = fetchFirestoreStats(context)
            
            // Back on main thread to apply RemoteViews updates and notify adapter changes
            scope.launch(Dispatchers.Main) {
                for (appWidgetId in appWidgetIds) {
                    updateAppWidget(context, appWidgetManager, appWidgetId, stats)
                }
            }
        }
    }

    private fun updateAppWidget(
        context: Context,
        appWidgetManager: AppWidgetManager,
        appWidgetId: Int,
        stats: ProjectStats
    ) {
        val views = RemoteViews(context.packageName, R.layout.renovation_widget_layout)

        // Bind the list adapter via Intent
        val serviceIntent = Intent(context, WidgetTasksService::class.java).apply {
            putExtra(AppWidgetManager.EXTRA_APPWIDGET_ID, appWidgetId)
            data = Uri.parse(toUri(Intent.URI_INTENT_SCHEME))
        }
        views.setRemoteAdapter(R.id.widget_list, serviceIntent)

        // Set action click on Refresh icon
        val refreshIntent = Intent(context, RenovationWidgetProvider::class.java).apply {
            action = AppWidgetManager.ACTION_APPWIDGET_UPDATE
            putExtra(AppWidgetManager.EXTRA_APPWIDGET_IDS, intArrayOf(appWidgetId))
        }
        val pendingRefresh = PendingIntent.getBroadcast(
            context,
            appWidgetId,
            refreshIntent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_MUTABLE
        )
        views.setOnClickPendingIntent(R.id.btn_refresh, pendingRefresh)

        // Main app launch integration (tapping title opens MainActivity)
        val mainPageIntent = Intent(context, MainActivity::class.java)
        val pendingMain = PendingIntent.getActivity(
            context,
            appWidgetId + 1000,
            mainPageIntent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_MUTABLE
        )
        views.setOnClickPendingIntent(R.id.widget_title, pendingMain)

        // Bind status values
        val auth = FirebaseAuth.getInstance()
        if (auth.currentUser == null) {
            views.setTextViewText(R.id.widget_stats, "Giriş yapılması bekleniyor.")
            views.setViewVisibility(R.id.widget_list, View.GONE)
            views.setViewVisibility(R.id.widget_empty_view, View.VISIBLE)
            views.setTextViewText(R.id.widget_empty_view, "Lütfen Tadilat uygulamasında oturum açın.")
            views.setTextViewText(R.id.widget_footer, "Kimlik doğrulanmadı")
        } else {
            views.setTextViewText(
                R.id.widget_stats,
                "${stats.activeProjectsCount} Aktif Şantiye, ${stats.pendingTasksCount} Bekleyen Görev"
            )
            views.setViewVisibility(R.id.widget_list, View.VISIBLE)
            views.setViewVisibility(R.id.widget_empty_view, View.GONE)
            
            val sdf = SimpleDateFormat("HH:mm:ss", Locale.getDefault())
            views.setTextViewText(
                R.id.widget_footer,
                context.getString(R.string.lbl_last_updated, sdf.format(Date()))
            )
        }

        // Notify ListView that it should update its items
        appWidgetManager.notifyAppWidgetViewDataChanged(appWidgetId, R.id.widget_list)
        appWidgetManager.updateAppWidget(appWidgetId, views)
    }

    private fun fetchFirestoreStats(context: Context): ProjectStats {
        try {
            // Safe initialize
            if (FirebaseApp.getApps(context).isEmpty()) {
                FirebaseApp.initializeApp(context)
            }
            
            val auth = FirebaseAuth.getInstance()
            val userId = auth.currentUser?.uid ?: return ProjectStats(0, 0)
            
            val db = FirebaseFirestore.getInstance(FirebaseApp.getInstance(), DATABASE_ID)
            
            // Synchronously retrieve details on background thread
            val projectsQuery = db.collection("projects")
                .whereEqualTo("userId", userId)
                .whereIn("status", listOf("ongoing", "planning"))
                .get()
            
            val tasksQuery = db.collection("tasks")
                .whereEqualTo("userId", userId)
                .whereEqualTo("status", "todo")
                .get()
                
            val projectsResult = Tasks.await(projectsQuery)
            val tasksResult = Tasks.await(tasksQuery)
            
            return ProjectStats(
                activeProjectsCount = projectsResult.size(),
                pendingTasksCount = tasksResult.size()
            )
        } catch (e: Exception) {
            e.printStackTrace()
            return ProjectStats(0, 0)
        }
    }
}

data class ProjectStats(
    val activeProjectsCount: Int,
    val pendingTasksCount: Int
)
