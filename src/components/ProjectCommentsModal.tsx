import React, { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/lib/auth'
import { MessageSquare, Send, Trash2, X, Users, UserPlus } from 'lucide-react'
import { format, parseISO } from 'date-fns'
import { cacheManager } from '@/lib/cache-manager'

interface Comment {
  id: string
  project_id: string
  user_id: string
  content: string
  created_at: string
  recipient_users?: string[]
  profiles?: {
    full_name?: string
    email: string
  }
}

interface User {
  id: string
  full_name?: string
  email: string
  avatar_url?: string
}

interface ProjectCommentsModalProps {
  projectId: string
  projectName: string
  projectOwnerId?: string
  onClose: () => void
}

export function ProjectCommentsModal({ projectId, projectName, projectOwnerId, onClose }: ProjectCommentsModalProps) {
  const { user, isAdmin } = useAuth()
  const [comments, setComments] = useState<Comment[]>([])
  const [newComment, setNewComment] = useState('')
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [availableUsers, setAvailableUsers] = useState<User[]>([])
  const [selectedUsers, setSelectedUsers] = useState<string[]>([])
  const [showUserSelector, setShowUserSelector] = useState(false)

  useEffect(() => {
    loadComments()
    loadAvailableUsers()
  }, [projectId])

  const loadAvailableUsers = async () => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, full_name, email, avatar_url')
        .neq('id', user?.id) // Exclude current user
        .order('full_name')

      if (error) {
        console.error('Error loading users:', error)
      } else {
        setAvailableUsers(data || [])
      }
    } catch (error) {
      console.error('Error loading users:', error)
    }
  }

  const loadComments = async () => {
    try {
      const { data, error } = await supabase
        .from('comments')
        .select(`
          id,
          project_id,
          user_id,
          content,
          created_at,
          recipient_users,
          profiles:user_id (
            full_name,
            email
          )
        `)
        .eq('project_id', projectId)
        .order('created_at', { ascending: false })

      if (error) {
        console.error('Error loading comments:', error)
      } else {
        // Transform the data to match our interface - profiles comes as array from Supabase
        const transformedData = (data || []).map((comment: any) => ({
          ...comment,
          profiles: Array.isArray(comment.profiles) ? comment.profiles[0] : comment.profiles
        }))
        setComments(transformedData)
      }
    } catch (error) {
      console.error('Error loading comments:', error)
    } finally {
      setLoading(false)
    }
  }

  const createNotificationsForComment = async (commentId: string) => {
    try {
      // Get the comment text from database
      const { data: commentData, error: commentError } = await supabase
        .from('comments')
        .select('content, user_id')
        .eq('id', commentId)
        .single()

      if (commentError || !commentData) {
        console.error('Error fetching comment for notifications:', commentError)
        return
      }

      // Get all collaborators and admins (excluding the current user)
      const { data: allUsers, error: usersError } = await supabase
        .from('profiles')
        .select('id')
        .neq('id', user?.id || '')
        .in('role', ['collaborator', 'super_admin', 'admin'])

      if (usersError) {
        console.error('Error fetching users for notifications:', usersError)
        return
      }

      // Get all users who have commented on this project (excluding current user)
      const { data: existingComments, error: commentsError } = await supabase
        .from('comments')
        .select('user_id')
        .eq('project_id', projectId)
        .neq('user_id', user?.id || '')

      if (commentsError) {
        console.error('Error fetching existing comments:', commentsError)
        return
      }

      // Combine all collaborators/admins with previous commenters to ensure comprehensive notifications
      const allPotentialRecipients = new Set<string>()
      
      // Add all collaborators and admins
      allUsers?.forEach(u => allPotentialRecipients.add(u.id))
      
      // Add users who have previously commented on this project
      existingComments?.forEach(c => allPotentialRecipients.add(c.user_id))

      // Remove the commenter themselves from the list
      allPotentialRecipients.delete(user?.id || '')

      // Final list of users to notify
      const finalUserList = Array.from(allPotentialRecipients)

      if (finalUserList.length === 0) {
        return // No one to notify
      }

      console.log(`Creating comment notifications for ${finalUserList.length} users:`, finalUserList)

      // Get commenter's name for notification
      const { data: commenterProfile } = await supabase
        .from('profiles')
        .select('full_name, email')
        .eq('id', commentData.user_id)
        .maybeSingle()

      const commenterName = commenterProfile?.full_name || commenterProfile?.email || 'Someone'

      // Create notifications for all relevant users
      const notifications = finalUserList.map(userId => ({
        user_id: userId,
        project_id: projectId,
        comment_id: commentId,
        type: 'comment',
        title: `New Comment on ${projectName}`,
        content: `${commenterName} commented: "${commentData.content.trim().substring(0, 100)}${commentData.content.trim().length > 100 ? '...' : ''}"`,
        link: `/projects?project_id=${projectId}`,
        is_read: false
      }))

      const { error } = await supabase
        .from('notifications')
        .insert(notifications)

      if (error) {
        console.error('Error creating notifications:', error)
      } else {
        console.log(`Successfully created ${notifications.length} comment notifications`)
      }
    } catch (error) {
      console.error('Error in createNotificationsForComment:', error)
    }
  }

  const handleUserToggle = (userId: string) => {
    setSelectedUsers(prev => 
      prev.includes(userId) 
        ? prev.filter(id => id !== userId)
        : [...prev, userId]
    )
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newComment.trim() || !user) return

    setSubmitting(true)
    try {
      const { data: newCommentData, error } = await supabase
        .from('comments')
        .insert({
          project_id: projectId,
          user_id: user.id,
          content: newComment.trim(),
          recipient_users: selectedUsers.length > 0 ? selectedUsers : null,
        })
        .select('id')
        .maybeSingle()

      if (error) {
        console.error('Error adding comment:', error)
        alert('Failed to add comment. Please try again.')
      } else {
        setNewComment('')
        setSelectedUsers([])
        loadComments()
        // Invalidate projects cache to update comment counts
        cacheManager.invalidate('projects')
        
        // Create notifications for all relevant users (project owner + previous commenters)
        if (newCommentData?.id) {
          await createNotificationsForComment(newCommentData.id)
        }
      }
    } catch (error) {
      console.error('Error adding comment:', error)
      alert('Failed to add comment. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  const handleDelete = async (commentId: string) => {
    if (!confirm('Are you sure you want to delete this comment?')) return

    try {
      const { error } = await supabase
        .from('comments')
        .delete()
        .eq('id', commentId)

      if (error) {
        console.error('Error deleting comment:', error)
        alert('Failed to delete comment. Please try again.')
      } else {
        loadComments()
        // Invalidate projects cache to update comment counts
        cacheManager.invalidate('projects')
      }
    } catch (error) {
      console.error('Error deleting comment:', error)
      alert('Failed to delete comment. Please try again.')
    }
  }

  const formatDate = (dateString: string) => {
    try {
      return format(parseISO(dateString), 'MMM dd, yyyy HH:mm')
    } catch {
      return dateString
    }
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 overflow-y-auto">
      <div className="bg-white dark:bg-gray-800 p-6 rounded-lg w-full max-w-2xl mx-4 my-8 max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center space-x-3">
            <MessageSquare className="w-6 h-6 text-blue-600 dark:text-blue-400" />
            <div>
              <h2 className="text-xl font-bold text-gray-900 dark:text-white">
                Project Comments
              </h2>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                {projectName}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Comments List */}
        <div className="flex-1 overflow-y-auto mb-4 space-y-4 min-h-[200px] max-h-[400px]">
          {loading ? (
            <div className="flex items-center justify-center h-32">
              <div className="text-gray-500 dark:text-gray-400">Loading comments...</div>
            </div>
          ) : comments.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-32 text-gray-500 dark:text-gray-400">
              <MessageSquare className="w-12 h-12 mb-2 opacity-50" />
              <p>No comments yet. Be the first to comment!</p>
            </div>
          ) : (
            comments.map((comment) => (
              <div
                key={comment.id}
                className="bg-gray-50 dark:bg-gray-700 p-4 rounded-lg"
              >
                <div className="flex items-start justify-between mb-2">
                  <div className="flex-1">
                    <div className="flex items-center space-x-2 mb-1">
                      <span className="font-semibold text-gray-900 dark:text-white">
                        {comment.profiles?.full_name || comment.profiles?.email || 'Unknown User'}
                      </span>
                      <span className="text-xs text-gray-500 dark:text-gray-400">
                        {formatDate(comment.created_at)}
                      </span>
                      {comment.recipient_users && comment.recipient_users.length > 0 && (
                        <span className="inline-flex items-center px-2 py-1 rounded-full text-xs bg-blue-100 dark:bg-blue-900/20 text-blue-800 dark:text-blue-300">
                          <UserPlus className="w-3 h-3 mr-1" />
                          To: {comment.recipient_users.length} user{comment.recipient_users.length > 1 ? 's' : ''}
                        </span>
                      )}
                    </div>
                    <p className="text-gray-700 dark:text-gray-300 whitespace-pre-wrap">
                      {comment.content}
                    </p>
                  </div>
                  {(user?.id === comment.user_id || isAdmin) && (
                    <button
                      onClick={() => handleDelete(comment.id)}
                      className="ml-2 text-red-600 dark:text-red-400 hover:text-red-800 dark:hover:text-red-300"
                      title="Delete comment"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>
            ))
          )}
        </div>

        {/* Add Comment Form */}
        <form onSubmit={handleSubmit} className="border-t border-gray-200 dark:border-gray-700 pt-4">
          {/* User Selection */}
          <div className="mb-3">
            <div className="flex items-center justify-between mb-2">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                <UserPlus className="w-4 h-4 inline mr-1" />
                Notify Users (Optional)
              </label>
              <button
                type="button"
                onClick={() => setShowUserSelector(!showUserSelector)}
                className="text-sm text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300"
              >
                {showUserSelector ? 'Hide' : 'Show'} Users
              </button>
            </div>
            
            {selectedUsers.length > 0 && (
              <div className="mb-2 flex flex-wrap gap-2">
                {selectedUsers.map(userId => {
                  const userInfo = availableUsers.find(u => u.id === userId)
                  return (
                    <span
                      key={userId}
                      className="inline-flex items-center px-2 py-1 rounded-full text-xs bg-blue-100 dark:bg-blue-900/20 text-blue-800 dark:text-blue-300"
                    >
                      {userInfo?.full_name || userInfo?.email}
                      <button
                        type="button"
                        onClick={() => handleUserToggle(userId)}
                        className="ml-1 text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300"
                      >
                        ×
                      </button>
                    </span>
                  )
                })}
              </div>
            )}
            
            {showUserSelector && (
              <div className="max-h-32 overflow-y-auto border border-gray-200 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700">
                {availableUsers.length === 0 ? (
                  <div className="p-3 text-sm text-gray-500 dark:text-gray-400 text-center">
                    No other users available
                  </div>
                ) : (
                  availableUsers.map(user => (
                    <label
                      key={user.id}
                      className="flex items-center p-2 hover:bg-gray-50 dark:hover:bg-gray-600 cursor-pointer"
                    >
                      <input
                        type="checkbox"
                        checked={selectedUsers.includes(user.id)}
                        onChange={() => handleUserToggle(user.id)}
                        className="w-4 h-4 text-blue-600 border-gray-300 dark:border-gray-600 rounded focus:ring-blue-500"
                      />
                      <div className="ml-3">
                        <div className="text-sm font-medium text-gray-900 dark:text-white">
                          {user.full_name || 'No name'}
                        </div>
                        <div className="text-xs text-gray-500 dark:text-gray-400">
                          {user.email}
                        </div>
                      </div>
                    </label>
                  ))
                )}
              </div>
            )}
          </div>
          
          <div className="mb-3">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Add Comment
            </label>
            <textarea
              value={newComment}
              onChange={(e) => setNewComment(e.target.value)}
              placeholder="Write your comment here..."
              rows={3}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
            />
          </div>
          <div className="flex items-center justify-between">
            <div className="text-xs text-gray-500 dark:text-gray-400">
              {newComment.trim() ? `${newComment.trim().length} characters` : '0 characters'}
            </div>
            <button
              type="submit"
              disabled={!newComment.trim() || submitting}
              className={`inline-flex items-center px-4 py-2 rounded-lg font-medium transition-all ${
                newComment.trim() && !submitting
                  ? 'bg-blue-600 hover:bg-blue-700 text-white shadow-sm'
                  : 'bg-gray-200 dark:bg-gray-700 text-gray-400 cursor-not-allowed'
              }`}
            >
              <Send className={`w-4 h-4 mr-2 ${submitting ? 'animate-pulse' : ''}`} />
              <span>{submitting ? 'Sending...' : 'Send Comment'}</span>
            </button>
          </div>
        </form>

        <div className="flex justify-end space-x-3 mt-4">
          <button
            onClick={onClose}
            className="px-4 py-2 text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  )
}