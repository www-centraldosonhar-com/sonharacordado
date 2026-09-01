import {
  requireDreamerUser,
} from './_dreamer-access.js'

import {
  calculateAttendanceFrequency,
  getOlympiadCampaign,
  listAttendanceEvents,
  saveFrequencySnapshots,
  setAttendanceEvent,
} from './_dreamer-frequency.js'

function adminOnly(response) {
  return response.status(403).json({
    error:
      'Apenas Admins do Sócio Sonhador podem configurar a frequência da Olimpíada.',
  })
}

export default async function handler(
  request,
  response
) {
  const currentUser =
    await requireDreamerUser(request)

  if (!currentUser) {
    return response.status(401).json({
      error:
        'Você não possui acesso ao Sócio Sonhador.',
    })
  }

  try {
    const campaign =
      await getOlympiadCampaign()

    if (!campaign) {
      return response.status(404).json({
        error:
          'Campanha Olimpíada Sonhadora não encontrada.',
      })
    }

    if (request.method === 'GET') {
      const frequency =
        await calculateAttendanceFrequency(
          campaign.id
        )

      const payload = {
        campaign,
        frequency,
      }

      if (currentUser.isDreamerAdmin) {
        payload.availableEvents =
          await listAttendanceEvents(
            campaign.id
          )
      }

      return response.status(200).json(
        payload
      )
    }

    if (request.method !== 'POST') {
      return response.status(405).json({
        error: 'Método não permitido.',
      })
    }

    if (!currentUser.isDreamerAdmin) {
      return adminOnly(response)
    }

    if (campaign.status === 'closed') {
      return response.status(409).json({
        error:
          'A Olimpíada já foi fechada. A frequência oficial está congelada.',
      })
    }

    const {
      operation,
      eventId,
      active,
    } = request.body ?? {}

    if (operation === 'set-event') {
      const numericEventId =
        Number(eventId)

      if (
        !Number.isInteger(numericEventId) ||
        numericEventId < 1 ||
        typeof active !== 'boolean'
      ) {
        return response.status(400).json({
          error:
            'Evento ou estado de seleção inválido.',
        })
      }

      const attendanceEvents =
        await listAttendanceEvents(
          campaign.id
        )

      const attendanceEvent =
        attendanceEvents.find(
          event =>
            Number(event.id) ===
            numericEventId
        )

      if (!attendanceEvent) {
        return response.status(404).json({
          error:
            'Evento ativo não encontrado.',
        })
      }

      // A Olimpíada passa a considerar apenas eventos escolhidos
      // a partir desta fase. Eventos antigos não podem ser
      // adicionados retroativamente, mas um evento já selecionado
      // pode ser removido mesmo depois de acontecer.
      if (
        active &&
        !attendanceEvent.selected &&
        !attendanceEvent.canSelect
      ) {
        return response.status(400).json({
          error:
            'A frequência da Olimpíada começa nos próximos eventos. Eventos anteriores não podem ser adicionados retroativamente.',
        })
      }

      const updated =
        await setAttendanceEvent({
          campaignId: campaign.id,
          eventId: numericEventId,
          active,
          userId: currentUser.id,
        })

      if (!updated) {
        return response.status(404).json({
          error:
            'Evento ativo não encontrado.',
        })
      }
    } else if (
      operation !== 'refresh-snapshots'
    ) {
      return response.status(400).json({
        error:
          'Operação de frequência inválida.',
      })
    }

    const frequency =
      await calculateAttendanceFrequency(
        campaign.id
      )

    await saveFrequencySnapshots({
      campaignId: campaign.id,
      frequency,
    })

    const availableEvents =
      await listAttendanceEvents(
        campaign.id
      )

    return response.status(200).json({
      success: true,
      campaign,
      frequency,
      availableEvents,
    })
  } catch (error) {
    console.error(
      'Dreamer frequency error:',
      error
    )

    return response.status(500).json({
      error:
        'Não foi possível calcular a frequência da Olimpíada Sonhadora.',
    })
  }
}
