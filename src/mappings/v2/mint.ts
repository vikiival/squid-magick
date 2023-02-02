import {
  CollectionEntity, NFTEntity
} from '../../model/generated'

import { plsBe, real } from '@kodadot1/metasquid/consolidator'
import md5 from 'md5'
import { unwrap } from '../utils'
import { isOwnerOrElseError } from '../utils/consolidator'

import { create, get } from '../utils/entity'
import { getCreateToken } from './getters'
import { ensure } from '../utils/helper'
import logger, { logError } from '../utils/logger'
import {
  Context, getNftId, NFT,
  Optional,
  Action
} from '../utils/types'
import { handleMetadata } from '../shared/metadata'
import { createEvent } from '../shared/event'
import { Mint } from '@vikiival/minimark/v2'

const OPERATION = Action.MINT

// TODO: MINT IS NOT CORRECTLY IMPLEMENTED
export async function mintItem(
  context: Context,
): Promise<void> {
  let nft: Optional<Mint> = null
  try {
    const { value, caller, timestamp, blockNumber, version } = unwrap(context, getCreateToken);
    const { value: nft, recipient } = value as Mint
    plsBe(real, nft.collection)
    const collection = ensure<CollectionEntity>(
      await get<CollectionEntity>(context.store, CollectionEntity, nft.collection)
    )
    plsBe(real, collection)
    isOwnerOrElseError(collection, caller)
    const id = getNftId(nft, blockNumber)
    // const entity = await get<NFTEntity>(context.store, NFTEntity, id) // TODO: check if exists
    // plsNotBe<NFTEntity>(real, entity as NFTEntity)
    const final = create<NFTEntity>(NFTEntity, id, {})
    final.id = id
    final.hash = md5(id)
    final.issuer = caller
    final.currentOwner = recipient || caller
    final.blockNumber = BigInt(blockNumber)
    final.name = nft.name
    final.instance = nft.symbol
    final.transferable = nft.transferable
    final.collection = collection
    final.sn = nft.sn
    final.metadata = nft.metadata
    final.price = BigInt(0)
    final.burned = false
    final.createdAt = timestamp
    final.updatedAt = timestamp
    final.emoteCount = 0
    final.version = version

    collection.updatedAt = timestamp
    collection.nftCount += 1 
    collection.supply += 1 

    if (final.metadata) {
      const metadata = await handleMetadata(final.metadata, '', context.store)
      final.meta = metadata
      if (metadata?.name && !final.name) {
        final.name = metadata.name
      }
    }

    logger.success(`[MINT] ${final.id}`)
    await context.store.save(final)
    await context.store.save(collection)
    await createEvent(final, Action.MINT, { blockNumber, caller, timestamp, version }, '', context.store)

  } catch (e) {
    logError(e, (e) =>
      logger.error(`[MINT] ${e.message}, ${JSON.stringify(nft)}`)
    )
  }
}
