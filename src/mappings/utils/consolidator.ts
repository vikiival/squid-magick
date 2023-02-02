import { BatchArg, ExtraCall, RmrkInteraction, Transfer } from './types'
import { CollectionEntity, NFTEntity } from '../../model/generated'
import { serializer } from './serializer'

import { real, burned, plsBe, plsNotBe } from '@kodadot1/metasquid/consolidator'

type Entity = CollectionEntity | NFTEntity


export function transferable({ transferable }: NFTEntity) {
  return !!transferable
}

export function withMeta(interaction: RmrkInteraction): interaction is RmrkInteraction  {
  return !!interaction.value
}

export function isOwner(entity: Entity, caller: string) {
  return entity.currentOwner === caller
}

export function isIssuer(entity: Entity, caller: string) {
  return entity.issuer === caller
}


export function isOwnerOrElseError(entity: Entity, caller: string) {
  if (!isOwner(entity, caller)) {
    throw new ReferenceError(`[CONSOLIDATE Bad Owner] Entity: ${entity.issuer} Caller: ${caller}`)
  }
}

export function isInteractive(nft: NFTEntity): void {
  plsBe(real, nft)
  plsNotBe(burned, nft)
  plsBe(transferable, nft)
}

export function validateInteraction(nft: NFTEntity, interaction: RmrkInteraction) {
  plsBe(withMeta, interaction)
  isInteractive(nft)
}

export function isPositiveOrElseError(entity: bigint | number, excludeZero?: boolean): void {
  if (entity < Number(excludeZero)) {
    throw new ReferenceError(`[CONSOLIDATE isPositiveOrElseError] Entity: ${entity}`)
  }
}

export const isBalanceTransfer = ({ callIndex }: BatchArg): boolean => callIndex === '0x0400'
const canBuy = (nft: NFTEntity) => ({ to, value }: Transfer) => isOwner(nft, to) && BigInt(value) >= BigInt(nft.price ?? 0)

export function isBuyLegalOrElseError(entity: NFTEntity, extraCalls: Transfer[]) {
  const cb = canBuy(entity)
  const result = extraCalls.some(cb)
  if (!result) {
    throw new ReferenceError(`[CONSOLIDATE ILLEGAL BUY] Entity: ${entity.id} CALLS: ${JSON.stringify(extraCalls, serializer)}`)
  }
}

// kodadot/rubick#6
function paperCut({id}: NFTEntity, { remarkCount }: ExtraCall) {
  if (remarkCount > 1) {
    throw new ReferenceError(`[CONSOLIDATE] Entity: ${id} should have only one remark per batch, got: ${remarkCount}`)
  }
}
