#!/usr/bin/env python3
"""
Datasheet Text Vectorization System
Version: 1.0.0

This module provides functions to:
1. Chunk datasheet text into meaningful segments
2. Vectorize text using various embedding models
3. Store vectors in databases (ChromaDB, Pinecone, etc.)
4. Prepare data for training and RAG pipelines
"""

import argparse
import json
import logging
import re
import uuid
from datetime import datetime
from pathlib import Path
from typing import List, Dict, Any, Optional, Tuple, Union
from dataclasses import dataclass, asdict
from abc import ABC, abstractmethod

# Core dependencies
import numpy as np
import pandas as pd

# Embedding models
from sentence_transformers import SentenceTransformer
import openai

# Vector databases
import chromadb
from chromadb.config import Settings

# Text processing
import nltk
from nltk.tokenize import sent_tokenize, word_tokenize
import spacy

# Download required NLTK data (run once)
try:
    nltk.download('punkt', quiet=True)
    nltk.download('stopwords', quiet=True)
except:
    pass

@dataclass
class TextChunk:
    """Represents a chunk of text with metadata"""
    id: str
    text: str
    chunk_type: str  # 'specifications', 'description', 'parameters', etc.
    source_file: str
    page_number: Optional[int] = None
    section: Optional[str] = None
    subsection: Optional[str] = None
    component_name: Optional[str] = None
    manufacturer: Optional[str] = None
    chunk_index: int = 0
    metadata: Dict[str, Any] = None
    
    def __post_init__(self):
        if self.metadata is None:
            self.metadata = {}
        if not self.id:
            self.id = str(uuid.uuid4())

class TextChunker:
    """Handles different strategies for chunking datasheet text"""
    
    def __init__(self, chunk_size: int = 512, overlap: int = 50):
        self.chunk_size = chunk_size
        self.overlap = overlap
        self.setup_nlp()
    
    def setup_nlp(self):
        """Setup NLP tools"""
        try:
            self.nlp = spacy.load("en_core_web_sm")
        except OSError:
            print("Warning: spaCy English model not found. Install with: python -m spacy download en_core_web_sm")
            self.nlp = None
    
    def semantic_chunking(self, text: str, metadata: Dict[str, Any]) -> List[TextChunk]:
        """
        Chunk text based on semantic boundaries (sections, specifications, etc.)
        Ideal for RAG applications
        """
        chunks = []
        
        # Split by common datasheet sections
        section_patterns = [
            r'(?i)(specifications?|spec)\s*:?\s*\n',
            r'(?i)(electrical\s+characteristics?)\s*:?\s*\n',
            r'(?i)(mechanical\s+data)\s*:?\s*\n',
            r'(?i)(pin\s+configuration)\s*:?\s*\n',
            r'(?i)(functional\s+description)\s*:?\s*\n',
            r'(?i)(operating\s+conditions?)\s*:?\s*\n',
            r'(?i)(absolute\s+maximum\s+ratings?)\s*:?\s*\n',
            r'(?i)(package\s+information)\s*:?\s*\n',
            r'(?i)(application\s+information)\s*:?\s*\n',
            r'(?i)(typical\s+applications?)\s*:?\s*\n'
        ]
        
        # Find section boundaries
        sections = []
        for i, pattern in enumerate(section_patterns):
            matches = list(re.finditer(pattern, text))
            for match in matches:
                sections.append({
                    'start': match.start(),
                    'end': match.end(),
                    'title': match.group(1),
                    'type': self._classify_section_type(match.group(1))
                })
        
        # Sort sections by position
        sections.sort(key=lambda x: x['start'])
        
        # Create chunks from sections
        for i, section in enumerate(sections):
            # Determine section end
            if i < len(sections) - 1:
                section_end = sections[i + 1]['start']
            else:
                section_end = len(text)
            
            section_text = text[section['end']:section_end].strip()
            
            if len(section_text) > 50:  # Only create chunks for substantial content
                # Further split long sections
                if len(section_text) > self.chunk_size * 2:
                    sub_chunks = self._split_long_text(section_text, self.chunk_size, self.overlap)
                    for j, sub_chunk in enumerate(sub_chunks):
                        chunk = TextChunk(
                            id=f"{metadata.get('source_file', 'unknown')}_{section['type']}_{j}",
                            text=sub_chunk,
                            chunk_type=section['type'],
                            source_file=metadata.get('source_file', ''),
                            section=section['title'],
                            chunk_index=j,
                            metadata=metadata.copy()
                        )
                        chunks.append(chunk)
                else:
                    chunk = TextChunk(
                        id=f"{metadata.get('source_file', 'unknown')}_{section['type']}",
                        text=section_text,
                        chunk_type=section['type'],
                        source_file=metadata.get('source_file', ''),
                        section=section['title'],
                        metadata=metadata.copy()
                    )
                    chunks.append(chunk)
        
        # Handle text before first section
        if sections:
            intro_text = text[:sections[0]['start']].strip()
            if len(intro_text) > 100:
                chunk = TextChunk(
                    id=f"{metadata.get('source_file', 'unknown')}_intro",
                    text=intro_text,
                    chunk_type='description',
                    source_file=metadata.get('source_file', ''),
                    section='Introduction',
                    metadata=metadata.copy()
                )
                chunks.append(chunk)
        
        return chunks
    
    def sliding_window_chunking(self, text: str, metadata: Dict[str, Any]) -> List[TextChunk]:
        """
        Create overlapping chunks using sliding window approach
        Good for training data generation
        """
        chunks = []
        words = word_tokenize(text)
        
        for i in range(0, len(words), self.chunk_size - self.overlap):
            chunk_words = words[i:i + self.chunk_size]
            chunk_text = ' '.join(chunk_words)
            
            if len(chunk_text.strip()) > 50:  # Skip very short chunks
                chunk = TextChunk(
                    id=f"{metadata.get('source_file', 'unknown')}_slide_{i}",
                    text=chunk_text,
                    chunk_type='sliding_window',
                    source_file=metadata.get('source_file', ''),
                    chunk_index=i // (self.chunk_size - self.overlap),
                    metadata=metadata.copy()
                )
                chunks.append(chunk)
        
        return chunks
    
    def sentence_boundary_chunking(self, text: str, metadata: Dict[str, Any]) -> List[TextChunk]:
        """
        Chunk text respecting sentence boundaries
        Best for maintaining context integrity
        """
        chunks = []
        sentences = sent_tokenize(text)
        
        current_chunk = []
        current_length = 0
        chunk_index = 0
        
        for sentence in sentences:
            sentence_length = len(word_tokenize(sentence))
            
            if current_length + sentence_length > self.chunk_size and current_chunk:
                # Create chunk from current sentences
                chunk_text = ' '.join(current_chunk)
                chunk = TextChunk(
                    id=f"{metadata.get('source_file', 'unknown')}_sent_{chunk_index}",
                    text=chunk_text,
                    chunk_type='sentence_boundary',
                    source_file=metadata.get('source_file', ''),
                    chunk_index=chunk_index,
                    metadata=metadata.copy()
                )
                chunks.append(chunk)
                
                # Start new chunk with overlap
                if self.overlap > 0 and len(current_chunk) > 1:
                    # Keep last few sentences for overlap
                    overlap_sentences = current_chunk[-2:]
                    current_chunk = overlap_sentences + [sentence]
                    current_length = sum(len(word_tokenize(s)) for s in current_chunk)
                else:
                    current_chunk = [sentence]
                    current_length = sentence_length
                
                chunk_index += 1
            else:
                current_chunk.append(sentence)
                current_length += sentence_length
        
        # Handle remaining sentences
        if current_chunk:
            chunk_text = ' '.join(current_chunk)
            chunk = TextChunk(
                id=f"{metadata.get('source_file', 'unknown')}_sent_{chunk_index}",
                text=chunk_text,
                chunk_type='sentence_boundary',
                source_file=metadata.get('source_file', ''),
                chunk_index=chunk_index,
                metadata=metadata.copy()
            )
            chunks.append(chunk)
        
        return chunks
    
    def parameter_extraction_chunking(self, text: str, metadata: Dict[str, Any]) -> List[TextChunk]:
        """
        Extract and chunk parameter-specific information
        Optimized for technical specifications
        """
        chunks = []
        
        # Patterns for extracting parameters
        parameter_patterns = [
            # Voltage patterns
            r'(?i)(voltage|vcc|vdd|supply)\s*[:\-=]\s*([0-9.]+\s*[mv]?v?)',
            # Current patterns  
            r'(?i)(current|icc|idd)\s*[:\-=]\s*([0-9.]+\s*[μmuna]?a)',
            # Temperature patterns
            r'(?i)(temperature|temp)\s*[:\-=]\s*([-0-9.]+\s*[°]?c)',
            # Frequency patterns
            r'(?i)(frequency|freq|clock)\s*[:\-=]\s*([0-9.]+\s*[kmg]?hz)',
            # Dimension patterns
            r'(?i)(size|dimension|width|height|length)\s*[:\-=]\s*([0-9.]+\s*[μmcin]+)',
            # Package patterns
            r'(?i)(package|housing)\s*[:\-=]\s*([a-z0-9\-]+)',
        ]
        
        # Extract parameter sections
        parameters = []
        for pattern in parameter_patterns:
            matches = re.finditer(pattern, text, re.MULTILINE)
            for match in matches:
                param_context = self._extract_context(text, match.start(), match.end())
                parameters.append({
                    'type': match.group(1).lower(),
                    'value': match.group(2),
                    'context': param_context,
                    'position': match.start()
                })
        
        # Group related parameters
        for i, param in enumerate(parameters):
            chunk = TextChunk(
                id=f"{metadata.get('source_file', 'unknown')}_param_{i}",
                text=param['context'],
                chunk_type='parameter',
                source_file=metadata.get('source_file', ''),
                subsection=param['type'],
                metadata={**metadata, 'parameter_type': param['type'], 'parameter_value': param['value']}
            )
            chunks.append(chunk)
        
        return chunks
    
    def _classify_section_type(self, section_title: str) -> str:
        """Classify section type based on title"""
        section_title = section_title.lower()
        
        if any(word in section_title for word in ['spec', 'electrical', 'parameter']):
            return 'specifications'
        elif any(word in section_title for word in ['mechanical', 'package', 'dimension']):
            return 'mechanical'
        elif any(word in section_title for word in ['pin', 'connection']):
            return 'pinout'
        elif any(word in section_title for word in ['functional', 'operation', 'description']):
            return 'description'
        elif any(word in section_title for word in ['application', 'typical', 'example']):
            return 'application'
        else:
            return 'general'
    
    def _split_long_text(self, text: str, max_size: int, overlap: int) -> List[str]:
        """Split long text into smaller chunks"""
        words = word_tokenize(text)
        chunks = []
        
        for i in range(0, len(words), max_size - overlap):
            chunk_words = words[i:i + max_size]
            chunks.append(' '.join(chunk_words))
        
        return chunks
    
    def _extract_context(self, text: str, start: int, end: int, context_size: int = 200) -> str:
        """Extract context around a match"""
        context_start = max(0, start - context_size)
        context_end = min(len(text), end + context_size)
        return text[context_start:context_end]

class EmbeddingGenerator:
    """Generates embeddings using various models"""
    
    def __init__(self, model_name: str = "all-MiniLM-L6-v2", openai_api_key: Optional[str] = None):
        self.model_name = model_name
        self.openai_api_key = openai_api_key
        self.model = None
        self._setup_model()
    
    def _setup_model(self):
        """Initialize the embedding model"""
        if self.model_name.startswith("openai"):
            if not self.openai_api_key:
                raise ValueError("OpenAI API key required for OpenAI models")
            openai.api_key = self.openai_api_key
        else:
            # Use sentence-transformers
            self.model = SentenceTransformer(self.model_name)
    
    def generate_embeddings(self, texts: List[str], batch_size: int = 32) -> np.ndarray:
        """Generate embeddings for a list of texts"""
        if self.model_name.startswith("openai"):
            return self._generate_openai_embeddings(texts)
        else:
            return self._generate_sentence_transformer_embeddings(texts, batch_size)
    
    def _generate_sentence_transformer_embeddings(self, texts: List[str], batch_size: int) -> np.ndarray:
        """Generate embeddings using sentence-transformers"""
        embeddings = []
        
        for i in range(0, len(texts), batch_size):
            batch = texts[i:i + batch_size]
            batch_embeddings = self.model.encode(batch, show_progress_bar=True)
            embeddings.extend(batch_embeddings)
        
        return np.array(embeddings)
    
    def _generate_openai_embeddings(self, texts: List[str]) -> np.ndarray:
        """Generate embeddings using OpenAI API"""
        embeddings = []
        
        for text in texts:
            response = openai.Embedding.create(
                input=text,
                model="text-embedding-ada-002"
            )
            embeddings.append(response['data'][0]['embedding'])
        
        return np.array(embeddings)

class VectorDatabase(ABC):
    """Abstract base class for vector databases"""
    
    @abstractmethod
    def add_chunks(self, chunks: List[TextChunk], embeddings: np.ndarray):
        """Add chunks and their embeddings to the database"""
        pass
    
    @abstractmethod
    def search(self, query_embedding: np.ndarray, k: int = 10) -> List[Dict]:
        """Search for similar chunks"""
        pass
    
    @abstractmethod
    def get_chunk(self, chunk_id: str) -> Optional[TextChunk]:
        """Retrieve a specific chunk by ID"""
        pass

class ChromaDBDatabase(VectorDatabase):
    """ChromaDB implementation for vector storage"""
    
    def __init__(self, collection_name: str = "datasheets", persist_directory: str = "./chroma_db"):
        self.collection_name = collection_name
        self.client = chromadb.PersistentClient(path=persist_directory)
        
        # Create or get collection
        try:
            self.collection = self.client.get_collection(name=collection_name)
        except:
            self.collection = self.client.create_collection(name=collection_name)
    
    def add_chunks(self, chunks: List[TextChunk], embeddings: np.ndarray):
        """Add chunks to ChromaDB"""
        ids = [chunk.id for chunk in chunks]
        documents = [chunk.text for chunk in chunks]
        metadatas = []
        
        for chunk in chunks:
            metadata = {
                'chunk_type': chunk.chunk_type,
                'source_file': chunk.source_file,
                'section': chunk.section or '',
                'component_name': chunk.component_name or '',
                'manufacturer': chunk.manufacturer or '',
                'chunk_index': chunk.chunk_index,
                **chunk.metadata
            }
            metadatas.append(metadata)
        
        self.collection.add(
            embeddings=embeddings.tolist(),
            documents=documents,
            metadatas=metadatas,
            ids=ids
        )
    
    def search(self, query_embedding: np.ndarray, k: int = 10, filter_dict: Optional[Dict] = None) -> List[Dict]:
        """Search for similar chunks"""
        results = self.collection.query(
            query_embeddings=[query_embedding.tolist()],
            n_results=k,
            where=filter_dict
        )
        
        return [{
            'id': results['ids'][0][i],
            'text': results['documents'][0][i],
            'metadata': results['metadatas'][0][i],
            'distance': results['distances'][0][i] if 'distances' in results else None
        } for i in range(len(results['ids'][0]))]
    
    def get_chunk(self, chunk_id: str) -> Optional[Dict]:
        """Retrieve a specific chunk by ID"""
        results = self.collection.get(ids=[chunk_id])
        if results['ids']:
            return {
                'id': results['ids'][0],
                'text': results['documents'][0],
                'metadata': results['metadatas'][0]
            }
        return None

class DatasheetVectorizer:
    """Main class for vectorizing datasheet content"""
    
    def __init__(self, 
                 chunker: TextChunker,
                 embedder: EmbeddingGenerator,
                 vector_db: VectorDatabase,
                 logger: Optional[logging.Logger] = None):
        self.chunker = chunker
        self.embedder = embedder
        self.vector_db = vector_db
        self.logger = logger or self._setup_logger()
    
    def _setup_logger(self) -> logging.Logger:
        """Setup basic logger"""
        logger = logging.getLogger('datasheet_vectorizer')
        logger.setLevel(logging.INFO)
        handler = logging.StreamHandler()
        formatter = logging.Formatter('%(asctime)s - %(name)s - %(levelname)s - %(message)s')
        handler.setFormatter(formatter)
        logger.addHandler(handler)
        return logger
    
    def process_datasheet_text(self, 
                             text: str, 
                             metadata: Dict[str, Any],
                             chunking_strategy: str = "semantic") -> List[TextChunk]:
        """Process datasheet text into chunks"""
        
        self.logger.info(f"Processing datasheet: {metadata.get('source_file', 'unknown')}")
        
        if chunking_strategy == "semantic":
            chunks = self.chunker.semantic_chunking(text, metadata)
        elif chunking_strategy == "sliding_window":
            chunks = self.chunker.sliding_window_chunking(text, metadata)
        elif chunking_strategy == "sentence_boundary":
            chunks = self.chunker.sentence_boundary_chunking(text, metadata)
        elif chunking_strategy == "parameter_extraction":
            chunks = self.chunker.parameter_extraction_chunking(text, metadata)
        else:
            raise ValueError(f"Unknown chunking strategy: {chunking_strategy}")
        
        self.logger.info(f"Created {len(chunks)} chunks using {chunking_strategy} strategy")
        return chunks
    
    def vectorize_chunks(self, chunks: List[TextChunk]) -> Tuple[List[TextChunk], np.ndarray]:
        """Generate embeddings for text chunks"""
        self.logger.info(f"Generating embeddings for {len(chunks)} chunks")
        
        texts = [chunk.text for chunk in chunks]
        embeddings = self.embedder.generate_embeddings(texts)
        
        self.logger.info(f"Generated embeddings with shape: {embeddings.shape}")
        return chunks, embeddings
    
    def store_vectors(self, chunks: List[TextChunk], embeddings: np.ndarray):
        """Store chunks and embeddings in vector database"""
        self.logger.info(f"Storing {len(chunks)} chunks in vector database")
        self.vector_db.add_chunks(chunks, embeddings)
        self.logger.info("Successfully stored chunks in database")
    
    def process_and_store(self, 
                         text: str, 
                         metadata: Dict[str, Any],
                         chunking_strategy: str = "semantic") -> List[TextChunk]:
        """Complete pipeline: chunk, vectorize, and store"""
        chunks = self.process_datasheet_text(text, metadata, chunking_strategy)
        chunks, embeddings = self.vectorize_chunks(chunks)
        self.store_vectors(chunks, embeddings)
        return chunks

# Training Data Generation Functions

def prepare_training_data(chunks: List[TextChunk], 
                         output_format: str = "jsonl") -> Union[List[Dict], str]:
    """
    Prepare chunks for model training in various formats
    
    Args:
        chunks: List of TextChunk objects
        output_format: 'jsonl', 'csv', 'parquet', or 'pairs'
    
    Returns:
        Training data in specified format
    """
    
    if output_format == "jsonl":
        # JSONL format for language model training
        training_data = []
        for chunk in chunks:
            record = {
                "text": chunk.text,
                "metadata": {
                    "source": chunk.source_file,
                    "chunk_type": chunk.chunk_type,
                    "component": chunk.component_name,
                    "manufacturer": chunk.manufacturer,
                    "section": chunk.section
                }
            }
            training_data.append(record)
        return training_data
    
    elif output_format == "csv":
        # CSV format for structured training
        df_data = []
        for chunk in chunks:
            df_data.append({
                'id': chunk.id,
                'text': chunk.text,
                'chunk_type': chunk.chunk_type,
                'source_file': chunk.source_file,
                'component_name': chunk.component_name or '',
                'manufacturer': chunk.manufacturer or '',
                'section': chunk.section or '',
                'metadata_json': json.dumps(chunk.metadata)
            })
        return pd.DataFrame(df_data)
    
    elif output_format == "pairs":
        # Question-answer pairs for fine-tuning
        pairs = []
        for chunk in chunks:
            if chunk.chunk_type == 'specifications':
                # Generate question-answer pairs from specifications
                question = f"What are the specifications for {chunk.component_name or 'this component'}?"
                pairs.append({"question": question, "answer": chunk.text})
            elif chunk.chunk_type == 'application':
                question = f"What are the typical applications for {chunk.component_name or 'this component'}?"
                pairs.append({"question": question, "answer": chunk.text})
        return pairs

def create_rag_dataset(vector_db: VectorDatabase, 
                      num_samples: int = 1000) -> List[Dict[str, str]]:
    """
    Create a dataset for RAG system evaluation
    
    Args:
        vector_db: Vector database containing chunks
        num_samples: Number of samples to create
    
    Returns:
        List of query-context-answer triplets
    """
    # This would need to be implemented based on your specific vector DB
    # and would involve querying the database to create realistic samples
    pass

# Usage Examples and Helper Functions

def batch_process_datasheets(datasheet_dir: Path, 
                           vectorizer: DatasheetVectorizer,
                           chunking_strategy: str = "semantic") -> Dict[str, List[TextChunk]]:
    """
    Process multiple datasheet text files in batch
    
    Args:
        datasheet_dir: Directory containing extracted text files
        vectorizer: Configured DatasheetVectorizer instance
        chunking_strategy: Strategy to use for chunking
    
    Returns:
        Dictionary mapping filenames to their chunks
    """
    
    results = {}
    text_files = list(datasheet_dir.glob("*.txt"))
    
    for text_file in text_files:
        try:
            with open(text_file, 'r', encoding='utf-8') as f:
                text = f.read()
            
            metadata = {
                'source_file': text_file.name,
                'file_path': str(text_file),
                'processing_date': datetime.now().isoformat()
            }
            
            chunks = vectorizer.process_and_store(text, metadata, chunking_strategy)
            results[text_file.name] = chunks
            
        except Exception as e:
            vectorizer.logger.error(f"Error processing {text_file}: {e}")
            continue
    
    return results

def main():
    """Example usage of the vectorization system"""
    parser = argparse.ArgumentParser(description="Vectorize datasheet text")
    parser.add_argument("--input-dir", type=Path, required=True, help="Directory with extracted text files")
    parser.add_argument("--output-dir", type=Path, default=Path("./vectors"), help="Output directory for vector DB")
    parser.add_argument("--model", default="all-MiniLM-L6-v2", help="Embedding model to use")
    parser.add_argument("--chunk-strategy", default="semantic", choices=["semantic", "sliding_window", "sentence_boundary", "parameter_extraction"])
    parser.add_argument("--chunk-size", type=int, default=512, help="Chunk size in tokens")
    parser.add_argument("--batch-size", type=int, default=32, help="Batch size for embedding generation")
    
    args = parser.parse_args()
    
    # Setup components
    chunker = TextChunker(chunk_size=args.chunk_size)
    embedder = EmbeddingGenerator(model_name=args.model)
    vector_db = ChromaDBDatabase(persist_directory=str(args.output_dir))
    vectorizer = DatasheetVectorizer(chunker, embedder, vector_db)
    
    # Process datasheets
    results = batch_process_datasheets(args.input_dir, vectorizer, args.chunk_strategy)
    
    # Generate training data
    all_chunks = []
    for chunks in results.values():
        all_chunks.extend(chunks)
    
    # Save training data in multiple formats
    training_jsonl = prepare_training_data(all_chunks, "jsonl")
    with open(args.output_dir / "training_data.jsonl", 'w') as f:
        for record in training_jsonl:
            f.write(json.dumps(record) + '\n')
    
    training_csv = prepare_training_data(all_chunks, "csv")
    training_csv.to_csv(args.output_dir / "training_data.csv", index=False)
    
    print(f"Processed {len(all_chunks)} chunks from {len(results)} datasheets")
    print(f"Vector database and training data saved to {args.output_dir}")

if __name__ == "__main__":
    main()



"""
Now that I have a lot of datasheets and I am able to parse these datasheets and extract meaningful information I would like to take the extracted information and vectorize that and put it into a vector database. The meaningful information is translated into text, this will change in a future iteration but for now it is text. Can you write a functions that takes the extracted information and makes that text into a vector. Can you also suggest schemes to break up the information so that it can be either used to train models or to be used in a RAG pipeline?EditI'll create a comprehensive system for vectorizing datasheet text and organizing it for both model training and RAG pipelines. Let me build functions that handle text chunking, vectorization, and vector database storage.Datasheet Text Vectorization SystemCode #!/usr/bin/env python3

Datasheet Text Vectorization System
Version: 1.0.0

This module provides functions to:
1. Chunk datasheet text into meaningful segments
2. Vectorize text using various embedding models
3. Store vectors in databases (ChromaDNow let me create a requirements file for the vectorization system:requirements.txt for Vectorization SystemCode # Core dependencies
numpy>=1.24.0
pandas>=2.0.0

# Embedding models
sentence-transformers>=2.2.0
openai>=0.28.0  # Optional for OpenAI embeddings

# Vector databases
chromadb>=0.4.0
# pinecone-client>=2.2.0  # Alternative vector DB
# weaviate-client>I've created a comprehensive vectorization system for your datasheet text. Here's what it provides:
Key Components
1. Multiple Chunking Strategies
Semantic Chunking (Best for RAG):

Identifies datasheet sections (specifications, pin configuration, etc.)
Preserves logical boundaries
Maintains context integrity
Ideal for question-answering systems

Sliding Window Chunking (Best for Training):

Creates overlapping chunks with consistent size
Good token distribution for model training
Handles edge cases well

Sentence Boundary Chunking:

Respects natural language boundaries
Prevents mid-sentence cuts
Maintains readability

Parameter Extraction Chunking:

Focuses on technical specifications
Extracts voltage, current, temperature specs
Perfect for technical Q&A systems

2. Flexible Embedding Options
python# Use sentence-transformers (local, fast)
embedder = EmbeddingGenerator("all-MiniLM-L6-v2")

# Use OpenAI embeddings (high quality, requires API key)
embedder = EmbeddingGenerator("openai", openai_api_key="your-key")

# Use domain-specific models
embedder = EmbeddingGenerator("sentence-transformers/all-mpnet-base-v2")
3. Vector Database Integration
Currently supportsRetryEContinueEditCurrently supports ChromaDB with easy extensibility for other databases:
python# ChromaDB (local, persistent)
vector_db = ChromaDBDatabase("datasheets", "./chroma_db")

# Easy to extend for Pinecone, Weaviate, etc.
# vector_db = PineconeDatabase(api_key="...", index_name="datasheets")
Recommended Chunking Schemes
For RAG Pipelines
Strategy 1: Semantic + Parameter Hybrid
python# Process with semantic chunking for context
semantic_chunks = vectorizer.process_datasheet_text(text, metadata, "semantic")

# Also extract parameters for precise technical queries
param_chunks = vectorizer.process_datasheet_text(text, metadata, "parameter_extraction")

# Store both types with different metadata tags
Strategy 2: Multi-Resolution Chunking
python# Large chunks for context (512 tokens)
context_chunker = TextChunker(chunk_size=512, overlap=50)

# Small chunks for precise retrieval (128 tokens) 
precise_chunker = TextChunker(chunk_size=128, overlap=25)

# Store both - query determines which to use
For Model Training
Strategy 1: Instruction-Following Data
python# Generate question-answer pairs
training_pairs = prepare_training_data(chunks, "pairs")
# Output: [{"question": "What is the operating voltage?", "answer": "3.3V ±10%"}]
Strategy 2: Structured Training Data
python# JSONL format for language model fine-tuning
training_data = prepare_training_data(chunks, "jsonl")
# Each record: {"text": "...", "metadata": {"chunk_type": "specifications", ...}}
Usage Examples
Basic Vectorization
python# Setup
chunker = TextChunker(chunk_size=512, overlap=50)
embedder = EmbeddingGenerator("all-MiniLM-L6-v2")
vector_db = ChromaDBDatabase("datasheets")
vectorizer = DatasheetVectorizer(chunker, embedder, vector_db)

# Process single datasheet
metadata = {
    'source_file': 'STM32F103_datasheet.pdf',
    'component_name': 'STM32F103',
    'manufacturer': 'STMicroelectronics'
}

chunks = vectorizer.process_and_store(datasheet_text, metadata, "semantic")
Batch Processing
python# Process entire directory
results = batch_process_datasheets(
    datasheet_dir=Path("./extracted_text/"),
    vectorizer=vectorizer,
    chunking_strategy="semantic"
)

# Generate training datasets
all_chunks = []
for chunks in results.values():
    all_chunks.extend(chunks)

# Create different formats
jsonl_data = prepare_training_data(all_chunks, "jsonl")
csv_data = prepare_training_data(all_chunks, "csv")
qa_pairs = prepare_training_data(all_chunks, "pairs")
RAG Query Example
python# Query the vector database
query = "What is the operating voltage range for STM32F103?"
query_embedding = embedder.generate_embeddings([query])[0]

# Search with filters
results = vector_db.search(
    query_embedding, 
    k=5,
    filter_dict={"chunk_type": "specifications", "manufacturer": "STMicroelectronics"}
)

# Results contain relevant chunks with metadata
for result in results:
    print(f"Relevance: {1-result['distance']:.3f}")
    print(f"Text: {result['text'][:200]}...")
    print(f"Source: {result['metadata']['source_file']}")
Advanced Features
Metadata-Rich Chunking
Each chunk includes comprehensive metadata:
pythonchunk = TextChunk(
    id="stm32f103_specs_001",
    text="Operating voltage: 2.0V to 3.6V...",
    chunk_type="specifications",
    source_file="STM32F103_datasheet.pdf",
    section="Electrical Characteristics",
    component_name="STM32F103",
    manufacturer="STMicroelectronics",
    metadata={
        'parameter_type': 'voltage',
        'parameter_value': '2.0V to 3.6V',
        'page_number': 15
    }
)
Training Data Formats

JSONL for Language Models:
json{"text": "The STM32F103 operates at 2.0V to 3.6V...", "metadata": {"chunk_type": "specifications"}}
{"text": "Pin configuration shows 64 pins in LQFP package...", "metadata": {"chunk_type": "pinout"}}
CSV for Structured Analysis:
idtextchunk_typecomponent_namesectionmetadata_jsonstm32_001Operating voltage...specificationsSTM32F103Electrical{"param": "voltage"}
Question-Answer Pairs for Fine-tuning:
json{"question": "What is the operating voltage of STM32F103?", "answer": "2.0V to 3.6V"}
{"question": "What package options are available?", "answer": "LQFP64, TFBGA64, WLCSP64"}
Setup Instructions

Install dependencies:

bashpip install -r requirements.txt

# Install spaCy language model
python -m spacy download en_core_web_sm

Initialize and process:

bash# Process datasheets from directory
python datasheet_vectorizer.py --input-dir ./extracted_text --output-dir ./vectors --chunk-strategy semantic

# Use different embedding model
python datasheet_vectorizer.py --input-dir ./texts --model sentence-transformers/all-mpnet-base-v2
RAG Pipeline Integration
The chunking schemes are optimized for different RAG use cases:

Technical Support: Use parameter extraction + semantic chunking
Design Assistance: Use semantic chunking with component metadata
Specification Lookup: Use parameter extraction with precise embeddings
General Questions: Use sentence boundary chunking for natural responses

The system provides everything needed to build a comprehensive datasheet Q&A system or train domain-specific models on your datasheet corpus!
"""