export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.18"
  }
  public: {
    Tables: {
      comments: {
        Row: {
          author_id: string
          body: string
          created_at: string
          id: string
          parent_id: string | null
          post_id: string
          updated_at: string
        }
        Insert: {
          author_id?: string
          body: string
          created_at?: string
          id?: string
          parent_id?: string | null
          post_id: string
          updated_at?: string
        }
        Update: {
          author_id?: string
          body?: string
          created_at?: string
          id?: string
          parent_id?: string | null
          post_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "comments_author_id_fkey"
            columns: ["author_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "comments_parent_same_post_fkey"
            columns: ["parent_id", "post_id"]
            isOneToOne: false
            referencedRelation: "comments"
            referencedColumns: ["id", "post_id"]
          },
          {
            foreignKeyName: "comments_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "posts"
            referencedColumns: ["id"]
          },
        ]
      }
      entities: {
        Row: {
          address_line_1: string | null
          address_line_2: string | null
          category_id: string
          country: string | null
          created_at: string
          created_by: string | null
          description: string | null
          district: string | null
          id: string
          image_url: string | null
          locality: string | null
          name: string
          normalized_address: string | null
          normalized_locality: string | null
          normalized_name: string
          postal_code: string | null
          state: string | null
          updated_at: string
        }
        Insert: {
          address_line_1?: string | null
          address_line_2?: string | null
          category_id: string
          country?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          district?: string | null
          id?: string
          image_url?: string | null
          locality?: string | null
          name: string
          normalized_address?: string | null
          normalized_locality?: string | null
          normalized_name: string
          postal_code?: string | null
          state?: string | null
          updated_at?: string
        }
        Update: {
          address_line_1?: string | null
          address_line_2?: string | null
          category_id?: string
          country?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          district?: string | null
          id?: string
          image_url?: string | null
          locality?: string | null
          name?: string
          normalized_address?: string | null
          normalized_locality?: string | null
          normalized_name?: string
          postal_code?: string | null
          state?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "entities_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "entity_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "entities_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      entity_categories: {
        Row: {
          created_at: string
          id: string
          label: string
          slug: string
        }
        Insert: {
          created_at?: string
          id?: string
          label: string
          slug: string
        }
        Update: {
          created_at?: string
          id?: string
          label?: string
          slug?: string
        }
        Relationships: []
      }
      entity_ratings: {
        Row: {
          author_id: string
          created_at: string
          entity_id: string
          id: string
          post_id: string
          score: number
          updated_at: string
        }
        Insert: {
          author_id: string
          created_at?: string
          entity_id: string
          id?: string
          post_id: string
          score: number
          updated_at?: string
        }
        Update: {
          author_id?: string
          created_at?: string
          entity_id?: string
          id?: string
          post_id?: string
          score?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "entity_ratings_author_id_fkey"
            columns: ["author_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "entity_ratings_entity_id_fkey"
            columns: ["entity_id"]
            isOneToOne: false
            referencedRelation: "entities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "entity_ratings_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: true
            referencedRelation: "posts"
            referencedColumns: ["id"]
          },
        ]
      }
      follows: {
        Row: {
          created_at: string
          follower_id: string
          following_id: string
        }
        Insert: {
          created_at?: string
          follower_id: string
          following_id: string
        }
        Update: {
          created_at?: string
          follower_id?: string
          following_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "follows_follower_id_fkey"
            columns: ["follower_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "follows_following_id_fkey"
            columns: ["following_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      forum_memberships: {
        Row: {
          created_at: string
          forum_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          forum_id: string
          user_id?: string
        }
        Update: {
          created_at?: string
          forum_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "forum_memberships_forum_id_fkey"
            columns: ["forum_id"]
            isOneToOne: false
            referencedRelation: "forums"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "forum_memberships_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      forum_share_ratings: {
        Row: {
          created_at: string
          post_id: string
          score: number
        }
        Insert: {
          created_at?: string
          post_id: string
          score: number
        }
        Update: {
          created_at?: string
          post_id?: string
          score?: number
        }
        Relationships: [
          {
            foreignKeyName: "forum_share_ratings_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: true
            referencedRelation: "posts"
            referencedColumns: ["id"]
          },
        ]
      }
      forums: {
        Row: {
          cover_image_path: string | null
          created_at: string
          description: string | null
          id: string
          image_path: string | null
          name: string
          owner_id: string
          rules: string
          slug: string
          updated_at: string
        }
        Insert: {
          cover_image_path?: string | null
          created_at?: string
          description?: string | null
          id?: string
          image_path?: string | null
          name: string
          owner_id?: string
          rules?: string
          slug: string
          updated_at?: string
        }
        Update: {
          cover_image_path?: string | null
          created_at?: string
          description?: string | null
          id?: string
          image_path?: string | null
          name?: string
          owner_id?: string
          rules?: string
          slug?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "forums_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          actor_id: string
          comment_id: string | null
          created_at: string
          forum_id: string | null
          id: string
          notification_type: Database["public"]["Enums"]["notification_type"]
          post_id: string | null
          read_at: string | null
          recipient_id: string
          source_comment_id: string | null
          source_post_id: string | null
        }
        Insert: {
          actor_id: string
          comment_id?: string | null
          created_at?: string
          forum_id?: string | null
          id?: string
          notification_type: Database["public"]["Enums"]["notification_type"]
          post_id?: string | null
          read_at?: string | null
          recipient_id: string
          source_comment_id?: string | null
          source_post_id?: string | null
        }
        Update: {
          actor_id?: string
          comment_id?: string | null
          created_at?: string
          forum_id?: string | null
          id?: string
          notification_type?: Database["public"]["Enums"]["notification_type"]
          post_id?: string | null
          read_at?: string | null
          recipient_id?: string
          source_comment_id?: string | null
          source_post_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "notifications_actor_id_fkey"
            columns: ["actor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_comment_id_fkey"
            columns: ["comment_id"]
            isOneToOne: false
            referencedRelation: "comments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_forum_id_fkey"
            columns: ["forum_id"]
            isOneToOne: false
            referencedRelation: "forums"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "posts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_recipient_id_fkey"
            columns: ["recipient_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_source_comment_id_fkey"
            columns: ["source_comment_id"]
            isOneToOne: false
            referencedRelation: "comments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_source_post_id_fkey"
            columns: ["source_post_id"]
            isOneToOne: false
            referencedRelation: "posts"
            referencedColumns: ["id"]
          },
        ]
      }
      pick_follows: {
        Row: {
          created_at: string
          pick_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          pick_id: string
          user_id?: string
        }
        Update: {
          created_at?: string
          pick_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "pick_follows_pick_id_fkey"
            columns: ["pick_id"]
            isOneToOne: false
            referencedRelation: "picks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pick_follows_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      pick_items: {
        Row: {
          created_at: string
          entity_id: string
          note: string | null
          pick_id: string
          position: number
        }
        Insert: {
          created_at?: string
          entity_id: string
          note?: string | null
          pick_id: string
          position: number
        }
        Update: {
          created_at?: string
          entity_id?: string
          note?: string | null
          pick_id?: string
          position?: number
        }
        Relationships: [
          {
            foreignKeyName: "pick_items_entity_id_fkey"
            columns: ["entity_id"]
            isOneToOne: false
            referencedRelation: "entities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pick_items_pick_id_fkey"
            columns: ["pick_id"]
            isOneToOne: false
            referencedRelation: "picks"
            referencedColumns: ["id"]
          },
        ]
      }
      picks: {
        Row: {
          author_id: string
          created_at: string
          description: string | null
          id: string
          pick_type: Database["public"]["Enums"]["pick_type"]
          title: string
          updated_at: string
        }
        Insert: {
          author_id: string
          created_at?: string
          description?: string | null
          id?: string
          pick_type?: Database["public"]["Enums"]["pick_type"]
          title: string
          updated_at?: string
        }
        Update: {
          author_id?: string
          created_at?: string
          description?: string | null
          id?: string
          pick_type?: Database["public"]["Enums"]["pick_type"]
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "picks_author_id_fkey"
            columns: ["author_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      post_media: {
        Row: {
          alt_text: string | null
          created_at: string
          id: string
          position: number
          post_id: string
          storage_path: string
        }
        Insert: {
          alt_text?: string | null
          created_at?: string
          id?: string
          position: number
          post_id: string
          storage_path: string
        }
        Update: {
          alt_text?: string | null
          created_at?: string
          id?: string
          position?: number
          post_id?: string
          storage_path?: string
        }
        Relationships: [
          {
            foreignKeyName: "post_media_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "posts"
            referencedColumns: ["id"]
          },
        ]
      }
      posts: {
        Row: {
          author_id: string
          body: string | null
          created_at: string
          entity_id: string | null
          forum_id: string | null
          id: string
          post_type: Database["public"]["Enums"]["post_type"]
          updated_at: string
        }
        Insert: {
          author_id: string
          body?: string | null
          created_at?: string
          entity_id?: string | null
          forum_id?: string | null
          id?: string
          post_type: Database["public"]["Enums"]["post_type"]
          updated_at?: string
        }
        Update: {
          author_id?: string
          body?: string | null
          created_at?: string
          entity_id?: string | null
          forum_id?: string | null
          id?: string
          post_type?: Database["public"]["Enums"]["post_type"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "posts_author_id_fkey"
            columns: ["author_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "posts_entity_id_fkey"
            columns: ["entity_id"]
            isOneToOne: false
            referencedRelation: "entities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "posts_forum_id_fkey"
            columns: ["forum_id"]
            isOneToOne: false
            referencedRelation: "forums"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          bio: string | null
          created_at: string
          display_name: string | null
          id: string
          onboarding_completed_at: string | null
          updated_at: string
          username: string | null
        }
        Insert: {
          avatar_url?: string | null
          bio?: string | null
          created_at?: string
          display_name?: string | null
          id: string
          onboarding_completed_at?: string | null
          updated_at?: string
          username?: string | null
        }
        Update: {
          avatar_url?: string | null
          bio?: string | null
          created_at?: string
          display_name?: string | null
          id?: string
          onboarding_completed_at?: string | null
          updated_at?: string
          username?: string | null
        }
        Relationships: []
      }
      ratings: {
        Row: {
          created_at: string
          post_id: string
          rater_id: string
          score: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          post_id: string
          rater_id: string
          score: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          post_id?: string
          rater_id?: string
          score?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "ratings_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "posts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ratings_rater_id_fkey"
            columns: ["rater_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      create_ask_post_idempotent: {
        Args: {
          p_body: string
          p_media_paths?: string[]
          p_operation_id: string
          p_post_id: string
        }
        Returns: {
          author_id: string
          body: string | null
          created_at: string
          entity_id: string | null
          forum_id: string | null
          id: string
          post_type: Database["public"]["Enums"]["post_type"]
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "posts"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      create_ask_post_with_media: {
        Args: {
          p_body: string
          p_forum_id?: string
          p_media_paths?: string[]
          p_post_id: string
        }
        Returns: {
          author_id: string
          body: string | null
          created_at: string
          entity_id: string | null
          forum_id: string | null
          id: string
          post_type: Database["public"]["Enums"]["post_type"]
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "posts"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      create_entity: {
        Args: {
          p_address_line_1?: string
          p_address_line_2?: string
          p_category_slug: string
          p_country?: string
          p_description?: string
          p_district?: string
          p_image_url?: string
          p_locality?: string
          p_name: string
          p_postal_code?: string
          p_state?: string
        }
        Returns: {
          address_line_1: string | null
          address_line_2: string | null
          category_id: string
          country: string | null
          created_at: string
          created_by: string | null
          description: string | null
          district: string | null
          id: string
          image_url: string | null
          locality: string | null
          name: string
          normalized_address: string | null
          normalized_locality: string | null
          normalized_name: string
          postal_code: string | null
          state: string | null
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "entities"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      create_find_idempotent: {
        Args: {
          p_address_line_1?: string
          p_address_line_2?: string
          p_category_slug: string
          p_country?: string
          p_description?: string
          p_district?: string
          p_entity_id: string
          p_image_path?: string
          p_image_url?: string
          p_locality?: string
          p_name: string
          p_operation_id: string
          p_postal_code?: string
          p_state?: string
        }
        Returns: {
          address_line_1: string | null
          address_line_2: string | null
          category_id: string
          country: string | null
          created_at: string
          created_by: string | null
          description: string | null
          district: string | null
          id: string
          image_url: string | null
          locality: string | null
          name: string
          normalized_address: string | null
          normalized_locality: string | null
          normalized_name: string
          postal_code: string | null
          state: string | null
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "entities"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      create_forum_idempotent: {
        Args: {
          p_cover_image_path?: string
          p_description?: string
          p_forum_id: string
          p_image_path?: string
          p_name: string
          p_operation_id: string
          p_rules?: string
          p_slug: string
        }
        Returns: {
          cover_image_path: string | null
          created_at: string
          description: string | null
          id: string
          image_path: string | null
          name: string
          owner_id: string
          rules: string
          slug: string
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "forums"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      create_personal_pick: {
        Args: { p_description?: string; p_items?: Json; p_title: string }
        Returns: {
          author_id: string
          created_at: string
          description: string | null
          id: string
          pick_type: Database["public"]["Enums"]["pick_type"]
          title: string
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "picks"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      create_post_idempotent: {
        Args: {
          p_body?: string
          p_entity_id?: string
          p_forum_id?: string
          p_kind: string
          p_media_paths?: string[]
          p_operation_id: string
          p_post_id: string
          p_score?: number
        }
        Returns: {
          author_id: string
          body: string | null
          created_at: string
          entity_id: string | null
          forum_id: string | null
          id: string
          post_type: Database["public"]["Enums"]["post_type"]
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "posts"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      create_share_post_with_media: {
        Args: {
          p_body?: string
          p_entity_id: string
          p_forum_id?: string
          p_media_paths?: string[]
          p_post_id: string
          p_score: number
        }
        Returns: {
          author_id: string
          body: string | null
          created_at: string
          entity_id: string | null
          forum_id: string | null
          id: string
          post_type: Database["public"]["Enums"]["post_type"]
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "posts"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      get_ask_rating_summary: {
        Args: { target_post_id: string }
        Returns: {
          average_score: number
          rating_count: number
        }[]
      }
      get_post_list_engagement: {
        Args: { p_post_ids: string[] }
        Returns: {
          average_score: number | null
          comment_count: number
          post_id: string
          rating_count: number
        }[]
      }
      get_comments_page: {
        Args: {
          p_before_created_at?: string
          p_before_id?: string
          p_limit?: number
          p_parent_id?: string
          p_post_id: string
        }
        Returns: {
          author_id: string
          body: string
          created_at: string
          id: string
          parent_id: string | null
          post_id: string
          updated_at: string
        }[]
        SetofOptions: {
          from: "*"
          to: "comments"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      get_entity_rating_summary: {
        Args: { p_entity_id: string }
        Returns: {
          average_score: number
          rating_count: number
        }[]
      }
      get_forum_summaries: {
        Args: {
          p_before_created_at?: string
          p_before_id?: string
          p_forum_id?: string
          p_limit?: number
        }
        Returns: {
          cover_image_path: string
          created_at: string
          description: string
          id: string
          image_path: string
          is_member: boolean
          member_count: number
          name: string
          owner_id: string
          rules: string
          slug: string
          updated_at: string
        }[]
      }
      get_home_feed: {
        Args: {
          p_before_created_at?: string
          p_before_id?: string
          p_limit?: number
          p_mode?: string
        }
        Returns: {
          author_id: string
          body: string | null
          created_at: string
          entity_id: string | null
          forum_id: string | null
          id: string
          post_type: Database["public"]["Enums"]["post_type"]
          updated_at: string
        }[]
        SetofOptions: {
          from: "*"
          to: "posts"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      get_notifications_page: {
        Args: {
          p_before_created_at?: string
          p_before_id?: string
          p_limit?: number
        }
        Returns: {
          actor_id: string
          comment_id: string
          created_at: string
          forum_id: string
          id: string
          notification_type: Database["public"]["Enums"]["notification_type"]
          post_id: string
          read_at: string
          recipient_id: string
        }[]
      }
      get_picks_directory: {
        Args: {
          p_before_id?: string
          p_before_updated_at?: string
          p_limit?: number
          p_scope?: string
        }
        Returns: {
          author: Json
          author_id: string
          created_at: string
          description: string
          id: string
          image_previews: Json
          is_followed: boolean
          pick_type: Database["public"]["Enums"]["pick_type"]
          title: string
          updated_at: string
        }[]
      }
      lookup_ask_creation: {
        Args: { p_operation_id: string }
        Returns: {
          author_id: string
          body: string | null
          created_at: string
          entity_id: string | null
          forum_id: string | null
          id: string
          post_type: Database["public"]["Enums"]["post_type"]
          updated_at: string
        }[]
        SetofOptions: {
          from: "*"
          to: "posts"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      lookup_post_creation: {
        Args: { p_kind: string; p_operation_id: string }
        Returns: {
          author_id: string
          body: string | null
          created_at: string
          entity_id: string | null
          forum_id: string | null
          id: string
          post_type: Database["public"]["Enums"]["post_type"]
          updated_at: string
        }[]
        SetofOptions: {
          from: "*"
          to: "posts"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      lookup_resource_creation: {
        Args: { p_kind: string; p_operation_id: string }
        Returns: {
          resource_id: string
        }[]
      }
      save_ask_rating: {
        Args: { p_post_id: string; p_rater_id: string; p_score: number }
        Returns: {
          created_at: string
          post_id: string
          rater_id: string
          score: number
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "ratings"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      search_discover_posts: {
        Args: { p_limit?: number; p_query: string }
        Returns: {
          author_id: string
          body: string | null
          created_at: string
          entity_id: string | null
          forum_id: string | null
          id: string
          post_type: Database["public"]["Enums"]["post_type"]
          updated_at: string
        }[]
        SetofOptions: {
          from: "*"
          to: "posts"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      update_personal_pick: {
        Args: {
          p_description?: string
          p_items?: Json
          p_pick_id: string
          p_title: string
        }
        Returns: {
          author_id: string
          created_at: string
          description: string | null
          id: string
          pick_type: Database["public"]["Enums"]["pick_type"]
          title: string
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "picks"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      update_share_rating_post: {
        Args: { p_body?: string; p_post_id: string; p_score: number }
        Returns: {
          author_id: string
          body: string | null
          created_at: string
          entity_id: string | null
          forum_id: string | null
          id: string
          post_type: Database["public"]["Enums"]["post_type"]
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "posts"
          isOneToOne: true
          isSetofReturn: false
        }
      }
    }
    Enums: {
      notification_type:
        | "FOLLOW"
        | "ASK_RATING"
        | "COMMENT"
        | "REPLY"
        | "FORUM_JOIN"
        | "FORUM_POST"
      pick_type: "PERSONAL"
      post_type: "ASK" | "SHARE"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      notification_type: [
        "FOLLOW",
        "ASK_RATING",
        "COMMENT",
        "REPLY",
        "FORUM_JOIN",
        "FORUM_POST",
      ],
      pick_type: ["PERSONAL"],
      post_type: ["ASK", "SHARE"],
    },
  },
} as const
