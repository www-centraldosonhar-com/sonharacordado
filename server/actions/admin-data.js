import {
  getAdminTeamIds,
  isGlobalAdmin,
  isMediaAdmin,
  isProjectAdmin,
  isVolunteerTeamAdmin,
  requireAdmin,
  sql,
} from './_admin.js'

export default async function handler(request, response) {
  if (request.method !== 'GET') {
    return response.status(405).json({
      error: 'Method not allowed.',
    })
  }

  const admin = await requireAdmin(request)

  if (!admin) {
    return response.status(403).json({
      error: 'Acesso administrativo não autorizado.',
    })
  }

  try {
    const teams = await sql`
      SELECT
        id,
        code,
        name,
        active
      FROM teams
      WHERE active = 1
      ORDER BY name
    `

    const adminTeamIds =
      getAdminTeamIds(admin)

    const globalAdmin =
      isGlobalAdmin(admin)

    const projectAdmin =
      isProjectAdmin(admin)

    const mediaAdmin =
      isMediaAdmin(admin)

    const volunteerTeamAdmin =
      isVolunteerTeamAdmin(admin)

    const activitiesTeamAdmin =
      admin.adminScope === 'team' &&
      (admin.teams || []).some(
        (team) =>
          team.code === 'activities'
      )

    const canViewActivitiesOverview =
      globalAdmin ||
      projectAdmin ||
      activitiesTeamAdmin

    const canManageRegistrations =
      globalAdmin ||
      projectAdmin ||
      volunteerTeamAdmin

    const unrestrictedProjects =
      globalAdmin ||
      mediaAdmin

    const projects = await sql`
      SELECT
        id,
        name
      FROM projects
      WHERE
        ${unrestrictedProjects}
        OR id = ${admin.projectId}
      ORDER BY name
    `

    const users = await sql`
      SELECT
        u.id,
        u.name,
        u.email,
        u.user_type,
        u.active,
        u.avatar_path,
        u.project_id,
        u.profile_review_required,
        u.profile_review_message,
        p.name AS project,

        COALESCE(
          ARRAY_AGG(
            DISTINCT up.permission
          ) FILTER (
            WHERE
              up.permission IS NOT NULL
              AND up.active = 1
          ),
          ARRAY[]::text[]
        ) AS permissions,

        MAX(
          CASE
            WHEN
              up.permission = 'admin'
              AND up.active = 1
            THEN up.admin_scope
          END
        ) AS admin_scope,

        COALESCE(
          ARRAY_AGG(
            DISTINCT t.id
          ) FILTER (
            WHERE
              t.id IS NOT NULL
              AND ut.active = 1
          ),
          ARRAY[]::integer[]
        ) AS team_ids,

        COALESCE(
          ARRAY_AGG(
            DISTINCT t.name
          ) FILTER (
            WHERE
              t.name IS NOT NULL
              AND ut.active = 1
          ),
          ARRAY[]::text[]
        ) AS team_names

      FROM users u

      JOIN projects p
        ON u.project_id = p.id

      LEFT JOIN user_permissions up
        ON up.user_id = u.id

      LEFT JOIN user_teams ut
        ON ut.user_id = u.id
        AND ut.active = 1

      LEFT JOIN teams t
        ON t.id = ut.team_id
        AND t.active = 1

      WHERE
        ${globalAdmin}

        OR (
          ${projectAdmin}
          AND u.project_id =
            ${admin.projectId}
        )

        OR (
          ${mediaAdmin}
          AND EXISTS (
            SELECT 1
            FROM user_teams scoped_media
            JOIN teams scoped_team
              ON scoped_team.id =
                scoped_media.team_id
            WHERE
              scoped_media.user_id =
                u.id
              AND scoped_media.active = 1
              AND scoped_team.code =
                'media'
          )
        )

        OR (
          ${!globalAdmin &&
            !projectAdmin &&
            !mediaAdmin}

          AND u.project_id =
            ${admin.projectId}

          AND EXISTS (
            SELECT 1
            FROM user_teams scoped_ut
            WHERE
              scoped_ut.user_id = u.id
              AND scoped_ut.active = 1
              AND scoped_ut.team_id =
                ANY(
                  ${adminTeamIds}
                )
          )
        )

      GROUP BY
        u.id,
        u.name,
        u.email,
        u.user_type,
        u.active,
        u.avatar_path,
        u.project_id,
        u.profile_review_required,
        u.profile_review_message,
        p.name

      ORDER BY
        u.active DESC,
        u.name
    `

    const events = await sql`
      SELECT
        e.id,
        e.name,
        e.project_id,
        e.event_type,
        e.event_date,
        e.event_time,
        e.location,
        e.confirmation_deadline,
        e.registration_fee,
        e.registration_deadline,
        e.registrations_open,
        e.drive_link,
        e.event_image_path,
        e.active,
        p.name AS project
      FROM events e
      LEFT JOIN projects p
        ON e.project_id = p.id

      WHERE
        ${unrestrictedProjects}
        OR e.project_id =
          ${admin.projectId}

      ORDER BY
        e.event_date DESC,
        e.event_time DESC
    `

    const roles = await sql`
      SELECT
        r.id,
        r.name,
        r.team_id,
        r.allows_checklist,
        t.code AS team_code,
        t.name AS team_name
      FROM roles r
      LEFT JOIN teams t
        ON t.id = r.team_id
      ORDER BY
        t.name,
        r.name
    `

    const eventRoles = await sql`
      SELECT
        er.id,
        er.event_id,
        er.role_id,
        er.description,
        er.vacancy_limit,
        er.active,
        er.requires_delivery,
        er.delivery_deadline,
        er.team_id,
        team.code AS team_code,
        team.name AS team_name,
        e.name AS event_name,
        e.event_date,
        r.name AS role_name,
        r.allows_checklist,
        COUNT(c.id)::int AS confirmed_count
      FROM event_roles er
      JOIN events e
        ON er.event_id = e.id
      JOIN roles r
        ON er.role_id = r.id
      LEFT JOIN teams team
        ON team.id = er.team_id
      LEFT JOIN confirmations c
        ON c.event_role_id = er.id
        AND c.status = 'confirmed'

      WHERE
        ${unrestrictedProjects}
        OR e.project_id =
          ${admin.projectId}

      GROUP BY
        er.id,
        er.event_id,
        er.role_id,
        er.description,
        er.vacancy_limit,
        er.active,
        er.requires_delivery,
        er.delivery_deadline,
        er.team_id,
        team.code,
        team.name,
        e.name,
        e.event_date,
        r.name,
        r.allows_checklist
      ORDER BY
        e.event_date DESC,
        r.name
    `

    const tasks = await sql`
      SELECT
        t.id,
        t.title,
        t.description,
        t.event_id,
        t.project_id,
        t.team_id,
        project.name AS project_name,
        team.code AS team_code,
        team.name AS team_name,
        t.deadline,
        t.priority,
        t.status,
        t.volunteer_limit,
        t.active,
        e.name AS event_name,
        COUNT(tu.id)::int AS volunteer_count
      FROM tasks t
      LEFT JOIN events e
        ON t.event_id = e.id
      LEFT JOIN projects project
        ON project.id = t.project_id
      LEFT JOIN teams team
        ON team.id = t.team_id
      LEFT JOIN task_users tu
        ON tu.task_id = t.id
        AND tu.status = 'active'
      GROUP BY
        t.id,
        t.title,
        t.description,
        t.event_id,
        t.project_id,
        t.team_id,
        project.name,
        team.code,
        team.name,
        t.deadline,
        t.priority,
        t.status,
        t.volunteer_limit,
        t.active,
        e.name
      ORDER BY
        t.deadline DESC
    `

    // =====================================================
    // ACTIVITY PARTICIPANTS
    // =====================================================
    // Lista individualmente os voluntários confirmados nas
    // atividades dos eventos. O completed_at será usado pelo
    // admin para controlar a conclusão de cada participação.
    // =====================================================

    const activityParticipants = await sql`
      SELECT
        c.id AS confirmation_id,
        c.event_role_id,
        c.user_id,
        c.status,
        c.completed_at,
        c.photo_submitted_at,
        er.requires_delivery,
        er.delivery_deadline,
        u.name AS user_name,
        p.name AS project_name,
        r.name AS role_name,
        e.name AS event_name
      FROM confirmations c
      JOIN users u
        ON c.user_id = u.id
      JOIN projects p
        ON u.project_id = p.id
      JOIN event_roles er
        ON c.event_role_id = er.id
      JOIN roles r
        ON er.role_id = r.id
      JOIN events e
        ON er.event_id = e.id
      WHERE c.status = 'confirmed'
        AND c.completed_at IS NULL
        AND (
          ${unrestrictedProjects}
          OR e.project_id =
            ${admin.projectId}
        )
      ORDER BY
        e.event_date DESC,
        r.name,
        u.name
    `

    // =====================================================
    // MISSION PARTICIPANTS
    // =====================================================
    // Lista quem assumiu cada missão e permite que o Admin
    // acompanhe entrega e conclusão individual.
    // =====================================================

    const taskParticipants = await sql`
      SELECT
        tu.id AS participation_id,
        tu.task_id,
        tu.user_id,
        tu.status,
        tu.delivery_link,
        tu.submitted_at,
        tu.completed_at,
        u.name AS user_name,
        p.name AS project_name,
        t.title AS task_title
      FROM task_users tu
      JOIN users u
        ON tu.user_id = u.id
      JOIN projects p
        ON u.project_id = p.id
      JOIN tasks t
        ON tu.task_id = t.id
      WHERE tu.status = 'active'
      ORDER BY
        t.deadline DESC,
        u.name
    `

    const registrationCoupons =
      globalAdmin
        ? await sql`
      SELECT
        rc.id,
        rc.code,
        rc.usage_limit,
        rc.active,
        rc.created_at,
        COUNT(er.id)::int AS used_count
      FROM registration_coupons rc
      LEFT JOIN event_registrations er
        ON er.coupon_id = rc.id
        AND er.status IN (
          'pending_coupon_review',
          'confirmed'
        )
      GROUP BY
        rc.id,
        rc.code,
        rc.usage_limit,
        rc.active,
        rc.created_at
      ORDER BY rc.created_at DESC
    `

        : []

    const registrations = await sql`
      SELECT
        er.id,
        er.event_id,
        er.user_id,
        er.email,
        er.team,
        er.status,
        er.payment_receipt_path,
        er.rejection_reason,
        er.created_at,
        er.updated_at,
        er.reviewed_at,
        u.name AS user_name,
        p.name AS project_name,
        e.name AS event_name,
        e.event_date,
        e.registration_fee,
        rc.code AS coupon_code,
        r.name AS activity_name
      FROM event_registrations er
      JOIN users u
        ON er.user_id = u.id
      JOIN projects p
        ON u.project_id = p.id
      JOIN events e
        ON er.event_id = e.id
      LEFT JOIN registration_coupons rc
        ON er.coupon_id = rc.id
      LEFT JOIN LATERAL (
        SELECT roles.name
        FROM confirmations c
        JOIN event_roles evr
          ON c.event_role_id = evr.id
        JOIN roles
          ON evr.role_id = roles.id
        WHERE c.user_id = er.user_id
          AND evr.event_id = er.event_id
          AND c.status = 'confirmed'
        ORDER BY roles.name
        LIMIT 1
      ) r ON TRUE

      WHERE
        ${canManageRegistrations}
        AND (
          ${globalAdmin}
          OR e.project_id =
            ${admin.projectId}
        )

      ORDER BY
        e.event_date DESC,
        er.created_at DESC
    `


    // =====================================================
    // VOLUNTEER EVENT OVERVIEW
    // =====================================================
    // Visível apenas para:
    // - Admin Geral;
    // - Admin do Projeto;
    // - Admin da Equipe de Voluntários.
    //
    // Cada evento considera somente os voluntários ativos
    // pertencentes ao projeto daquele evento.
    // =====================================================

    const volunteerEventStats =
      canManageRegistrations
        ? await sql`
      SELECT
        e.id AS event_id,
        e.name AS event_name,
        e.event_date,
        e.project_id,

        p.name AS project_name,

        e.registration_fee,

        (
          SELECT COUNT(*)::int
          FROM users project_users
          WHERE
            project_users.project_id =
              e.project_id
            AND project_users.active = 1
        ) AS total_volunteers,

        (
          SELECT COUNT(*)::int
          FROM event_registrations registered
          WHERE
            registered.event_id = e.id
            AND registered.status =
              'confirmed'
        ) AS registered_count,

        (
          SELECT COUNT(*)::int
          FROM activity_checklist_items item

          JOIN activity_checklists checklist
            ON checklist.id =
              item.checklist_id

          JOIN event_roles check_role
            ON check_role.id =
              checklist.event_role_id

          WHERE
            check_role.event_id = e.id

            AND checklist.active = 1

            AND item.checked = 1
        ) AS present_count,

        EXISTS (
          SELECT 1
          FROM activity_checklists checklist

          JOIN event_roles check_role
            ON check_role.id =
              checklist.event_role_id

          WHERE
            check_role.event_id = e.id
            AND checklist.active = 1
        ) AS has_checklist,

        (
          SELECT
            COALESCE(
              SUM(
                CASE
                  WHEN registered.coupon_id IS NULL
                  THEN e.registration_fee
                  ELSE 0
                END
              ),
              0
            )
          FROM event_registrations registered
          WHERE
            registered.event_id = e.id
            AND registered.status =
              'confirmed'
        ) AS collected_amount

      FROM events e

      JOIN projects p
        ON p.id = e.project_id

      WHERE
        e.project_id IS NOT NULL

        AND (
          ${globalAdmin}
          OR e.project_id =
            ${admin.projectId}
        )

      ORDER BY
        e.event_date DESC,
        e.event_time DESC
    `
        : []

    // =====================================================
    // ACTIVITIES TEAM OVERVIEW
    // =====================================================
    //
    // Visível para:
    // - Admin Geral;
    // - Admin de Projeto;
    // - Admin da Equipe de Atividades.
    //
    // Aqui não existem funções ou vagas.
    // Mostramos apenas quem se inscreveu no evento
    // escolhendo a Equipe de Atividades.
    // =====================================================

    const activitiesEventStats =
      canViewActivitiesOverview
        ? await sql`
      SELECT
        e.id AS event_id,
        e.name AS event_name,
        e.event_date,
        e.project_id,

        p.name AS project_name,

        COUNT(er.id)::int
          AS registered_count,

        COALESCE(
          JSON_AGG(
            JSON_BUILD_OBJECT(
              'registration_id',
                er.id,
              'user_id',
                u.id,
              'name',
                u.name,
              'email',
                er.email,
              'status',
                er.status
            )
            ORDER BY u.name
          ) FILTER (
            WHERE er.id IS NOT NULL
          ),
          '[]'::json
        ) AS registrations

      FROM events e

      JOIN projects p
        ON p.id = e.project_id

      LEFT JOIN event_registrations er
        ON er.event_id = e.id
        AND er.team = 'activities'
        AND er.status = 'confirmed'

      LEFT JOIN users u
        ON u.id = er.user_id

      WHERE
        e.project_id IS NOT NULL

        AND (
          ${globalAdmin}
          OR e.project_id =
            ${admin.projectId}
        )

      GROUP BY
        e.id,
        e.name,
        e.event_date,
        e.project_id,
        p.name

      ORDER BY
        e.event_date DESC,
        e.event_time DESC
    `
        : []

    const announcements = await sql`
      SELECT
        a.id,
        a.title,
        a.message,
        a.priority,
        a.active,
        a.created_at,
        a.project_id,
        a.team_id,
        project.name AS project_name,
        team.code AS team_code,
        team.name AS team_name,
        u.name AS created_by_name
      FROM announcements a
      JOIN users u
        ON a.created_by = u.id
      LEFT JOIN projects project
        ON project.id = a.project_id
      LEFT JOIN teams team
        ON team.id = a.team_id
      ORDER BY
        a.created_at DESC
    `

    const confirmations = await sql`
      SELECT
        c.id,
        u.name,
        p.name AS project,
        r.name AS role,
        e.name AS event_name
      FROM confirmations c
      JOIN users u
        ON c.user_id = u.id
      JOIN projects p
        ON u.project_id = p.id
      JOIN event_roles er
        ON c.event_role_id = er.id
      JOIN roles r
        ON er.role_id = r.id
      JOIN events e
        ON er.event_id = e.id
      WHERE c.status = 'confirmed'
        AND (
          ${unrestrictedProjects}
          OR e.project_id =
            ${admin.projectId}
        )
      ORDER BY
        e.event_date DESC,
        u.name
    `

    return response.status(200).json({
      projects,
      teams,
      adminAccess: {
        scope:
          admin.adminScope,

        project: {
          id:
            admin.projectId,
          name:
            admin.project,
        },

        teams:
          admin.teams || [],

        canManageRegistrations,

        canViewActivitiesOverview,

        canManageCoupons:
          globalAdmin,
      },
      users,
      events,
      roles,
      eventRoles,
      tasks,
      registrationCoupons,
      registrations,
      volunteerEventStats,
      activitiesEventStats,
      activityParticipants,
      taskParticipants,
      announcements,
      confirmations,
    })
  } catch (error) {
    console.error(
      'Admin data error:',
      error
    )

    return response.status(500).json({
      error:
        'Não foi possível carregar o painel administrativo.',
    })
  }
}
